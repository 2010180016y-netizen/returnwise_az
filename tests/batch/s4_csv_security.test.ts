import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText, parseCsvBytes } from '../../src/features/batch/csvParser';
import { processBatchRows, generateBatchExportCsv } from '../../server/batch/batchProcessor';
import { sanitizeCell, serializeSafeCsv } from '../../server/batch/csvSanitizer';

const BASE_HEADER='판매가,초기배송비,회수배송비,수수료율,마켓';
const EVIDENCE_HEADER=BASE_HEADER+
  ',환급액,검수비,회수순가치,수수료환급액,기타추가비,구매자회수비,귀책사유,고객요청,정책확인,권리확인,특례품목,정책구버전';
const baseEvidence=[
  '30000','3000','3500','5.5','SMARTSTORE',
  '30000','0','0','0','0','0','BUYER_REMORSE','REFUND',
  'YES','YES','NO','NO',
];
function importEvidence(values=baseEvidence, extraHeader='', extraValue='') {
  const header=EVIDENCE_HEADER+(extraHeader?','+extraHeader:'');
  const row=values.join(',')+(extraValue?','+extraValue:'');
  const parsed=parseCsvText(header+'\r\n'+row);
  return {...parsed,results:processBatchRows(parsed.rows).results};
}

describe('S4 | strict RFC CSV parser',()=>{
  it('parses quoted comma, doubled quotes and embedded CRLF as one record',()=>{
    const text=BASE_HEADER+',메모\r\n'+
      '30000,1000,3500,5.50%,SMARTSTORE,"내역: ""반품"",\r\n전화 010-0000-0000"\r\n'+
      '45000,0,0,10,COUPANG,"=HYPERLINK(""malicious"")"';
    const {rows,summary}=parseCsvText(text);
    assert.equal(rows.length,2);
    assert.equal(summary.totalRows,2);
    assert.equal(summary.errorRows,0);
    assert.equal(rows[0].sourceLine,2);
    assert.equal(rows[1].sourceLine,4);
    assert.equal(rows[0].itemPrice,30000);
    assert.equal(rows[0].commissionRate,5.5);
    assert.ok(!JSON.stringify(rows).includes('010-0000-0000'));
    assert.ok(!JSON.stringify(rows).includes('HYPERLINK'));
  });

  it('accepts UTF-8 BOM and UTF-8 encoded bytes',()=>{
    const text='\uFEFF'+BASE_HEADER+'\n30000,0,0,0,COUPANG';
    assert.equal(parseCsvText(text).rows[0].itemPrice,30000);
    assert.equal(parseCsvBytes(new TextEncoder().encode(text)).rows[0].market,'COUPANG');
  });

  it('rejects corrupt/non-UTF8 bytes without lossy character replacement',()=>{
    assert.throws(()=>parseCsvBytes(new Uint8Array([0xc3,0x28])),/UTF-8/);
  });

  for(const malformed of [
    BASE_HEADER+'\n"30000,3000,3500,5.5,SMARTSTORE',
    BASE_HEADER+'\n30"000,3000,3500,5.5,SMARTSTORE',
    BASE_HEADER+'\n"30000"x,3000,3500,5.5,SMARTSTORE',
    BASE_HEADER+'\n30000,3000,3500,5.5,SMARTSTORE,EXTRA',
    BASE_HEADER+'\n30000,3000,3500,5.5,SMARTSTORE\0',
  ]) {
    it('malformed CSV is rejected or flagged without trusting shifted columns',()=>{
      try{
        const parsed=parseCsvText(malformed);
        assert.equal(parsed.summary.validRows,0);
        assert.ok(parsed.summary.errorRows>0);
      }catch(err){
        assert.ok(err instanceof Error);
      }
    });
  }

  it('rejects duplicate aliases for one financial column',()=>{
    assert.throws(()=>parseCsvText(BASE_HEADER+',price\n30000,0,0,0,COUPANG,30000'),/중복/);
  });

  it('ignores blank physical lines while counting 1000 logical CSV records',()=>{
    const text=BASE_HEADER+'\n\n'+'30000,0,0,0,COUPANG\n'.repeat(1000)+'\n';
    const result=parseCsvText(text);
    assert.equal(result.summary.totalRows,1000);
    assert.equal(result.summary.validRows,1000);
    assert.equal(result.rows[0].sourceLine,3);
    assert.throws(()=>parseCsvText(text+'30000,0,0,0,COUPANG'),/1000행/);
  });
});

describe('S4 | strict financial parsing and PII safety',()=>{
  for(const [label,input] of [
    ['scientific', '1e5'],
    ['Infinity','Infinity'],
    ['NaN','NaN'],
    ['negative','-30000'],
    ['fractional won','30000.1'],
    ['hex','0x7530'],
    ['misplaced thousands','30,00'],
    ['overflow','999999999999999999999999'],
    ['formula','=1+2'],
  ]){
    it('does not coerce '+label+' into a valid monetary amount',()=>{
      const price=input.includes(',')?'"'+input+'"':input;
      const {rows,summary}=parseCsvText(BASE_HEADER+'\n'+price+',0,0,5.5,SMARTSTORE');
      assert.equal(summary.errorRows,1);
      assert.equal(rows[0].itemPrice,null);
      assert.equal(processBatchRows(rows).results[0].status,'ERROR');
    });
  }

  it('preserves decimal commission rate without flooring and rejects above 100%',()=>{
    const {rows}=parseCsvText(BASE_HEADER+'\n30000,0,0,8.125%,COUPANG');
    assert.equal(rows[0].commissionRate,8.125);
    const bad=parseCsvText(BASE_HEADER+'\n30000,0,0,101%,COUPANG');
    assert.equal(bad.rows[0].commissionRate,null);
    assert.equal(bad.summary.errorRows,1);
  });

  it('does not silently default missing shipping, fee or marketplace values',()=>{
    const {rows,summary}=parseCsvText('판매가,초기배송비,회수배송비\n30000,,');
    assert.equal(rows[0].initialShipping,null);
    assert.equal(rows[0].returnShipping,null);
    assert.equal(rows[0].commissionRate,null);
    assert.equal(rows[0].market,'UNKNOWN');
    assert.equal(summary.errorRows,1);
    assert.ok(summary.columnErrors.length>=4);
    assert.equal(processBatchRows(rows).results[0].status,'ERROR');
  });

  it('counts rows with multiple invalid cells exactly once',()=>{
    const {rows,summary}=parseCsvText(BASE_HEADER+
      '\n-1,abc,-2,101,UNKNOWN\n30000,0,0,0,COUPANG');
    assert.equal(summary.totalRows,2);
    assert.equal(summary.validRows,1);
    assert.equal(summary.errorRows,1);
    assert.ok(summary.columnErrors.length>=5);
    assert.equal(processBatchRows(rows).results[1].status,'REVIEW_REQUIRED');
  });

  it('removes PII/unknown fields, never echoing private data in validation messages',()=>{
    const pii='홍길동 010-1234-5678 서울시 테헤란로 123';
    const csv=BASE_HEADER+',고객명,메모\n30000,0,0,0,INVALID,"'+pii+'" ,'+pii;
    // malformed structural data must be rejected or produce sanitized results
    assert.throws(()=>parseCsvText(csv));
    const safeCsv=BASE_HEADER+',고객명,메모\n30000,0,0,0,INVALID,"'+pii+'","'+pii+'"';
    const parsed=parseCsvText(safeCsv);
    assert.equal(parsed.summary.piiWarning,true);
    assert.ok(!JSON.stringify(parsed.rows).includes('홍길동'));
    assert.ok(!JSON.stringify(parsed.rows).includes('010-1234-5678'));
    assert.ok(!JSON.stringify(parsed.summary).includes('010-1234-5678'));
    const output=generateBatchExportCsv(processBatchRows(parsed.rows).results);
    assert.ok(!output.includes('홍길동'));
    assert.ok(!output.includes('010-1234-5678'));
    assert.ok(output.includes('UNKNOWN'));
  });

  it('rejects a CSV file larger than hard 5MiB even if options request bypass',()=>{
    assert.throws(()=>parseCsvText(BASE_HEADER+'\n30000,0,0,0,COUPANG',
      {maxFileSizeMb:999}),/처리 한도/);
    assert.throws(()=>parseCsvText(BASE_HEADER+'\n30000,0,0,0,COUPANG',
      {maxRows:1001}),/처리 한도/);
  });
});

describe('S4 | explicit evidence only, using existing legal and financial engine',()=>{
  it('unverified CSV has no recommendation, no money output and no fictitious savings',()=>{
    const {rows}=parseCsvText(BASE_HEADER+'\n30000,3000,3500,5.5,SMARTSTORE');
    const result=processBatchRows(rows).results[0];
    assert.equal(result.status,'REVIEW_REQUIRED');
    assert.equal(result.cashOutflow,null);
    assert.equal(result.economicCost,null);
    assert.equal(result.savingsVsBaseline,null);
  });

  it('explicit completed facts may produce only a CONDITIONAL estimate',()=>{
    const {rows,summary,results}=importEvidence();
    assert.equal(summary.validRows,1);
    assert.ok(rows[0].attestedScenario);
    const result=results[0];
    assert.equal(result.status,'ESTIMATE_ONLY');
    // RETURN_FULL = 30000 + 3500; KEEP_FULL = 30000.
    assert.equal(result.bestOptionCode,'C02');
    assert.equal(result.cashOutflow,30000);
    assert.equal(result.economicCost,30000);
    assert.equal(result.savingsVsBaseline,3500);
    assert.match(result.errorMessage??'',/보증하지 않습니다/);
  });

  it('verified salvaged item value changes economic optimum without fake value',()=>{
    const row=[...baseEvidence];row[7]='9000';
    const {results}=importEvidence(row);
    assert.equal(results[0].status,'ESTIMATE_ONLY');
    assert.equal(results[0].bestOptionCode,'C01');
    assert.equal(results[0].cashOutflow,33500);
    assert.equal(results[0].economicCost,24500);
    assert.equal(results[0].savingsVsBaseline,0);
  });

  it('policy or statutory-rights confirmation missing prevents estimates',()=>{
    for(const index of [13,14]){
      const row=[...baseEvidence];row[index]='NO';
      const {results}=importEvidence(row);
      assert.equal(results[0].status,'REVIEW_REQUIRED');
      assert.equal(results[0].economicCost,null);
    }
  });

  it('seller-fault buyer-return-shipping fee is not silently overlooked',()=>{
    const row=[...baseEvidence];
    row[10]='3500';row[11]='SELLER_FAULT';
    const {results}=importEvidence(row);
    assert.equal(results[0].status,'REVIEW_REQUIRED');
  });

  it('invalid policy values remain review-only or input-error, never a recommendation',()=>{
    const row=[...baseEvidence];row[13]='maybe';
    const {summary,results}=importEvidence(row);
    assert.equal(summary.errorRows,1);
    assert.equal(results[0].status,'ERROR');
  });

  it('partial refund is only considered with explicit sum and three user attestations',()=>{
    const header='합의부분환급액,자발적합의확인,부분환급약관허용,소비자권리비침해확인';
    const noConsent=importEvidence(baseEvidence,header,'15000,NO,YES,YES');
    assert.notEqual(noConsent.results[0].bestOptionCode,'C03');
    const agree=importEvidence(baseEvidence,header,'15000,YES,YES,YES');
    assert.equal(agree.results[0].status,'ESTIMATE_ONLY');
    assert.equal(agree.results[0].bestOptionCode,'C03');
    assert.equal(agree.results[0].economicCost,15000);
  });

  it('buyer-requested exchange is never ranked against a refund group',()=>{
    const row=[...baseEvidence];row[12]='EXCHANGE';
    const result=importEvidence(row,'교환원가,교환출고비,교환동의','1200,800,YES');
    assert.notEqual(result.results[0].bestOptionCode,'C15');
  });

  it('unknown marketplace cannot become a valid verified legal platform',()=>{
    const row=[...baseEvidence];row[4]='=HYPERLINK(steal)';
    const {rows,results}=importEvidence(row);
    assert.equal(rows[0].market,'UNKNOWN');
    assert.equal(results[0].status,'ERROR');
    assert.ok(!JSON.stringify(results).includes('HYPERLINK'));
  });

  it('directly forged attestation with altered return cost cannot pass processor',()=>{
    const {rows}=importEvidence();
    if(!rows[0].attestedScenario) throw Error('test evidence missing');
    rows[0].attestedScenario.inputs.reverseShippingSellerCost=0;
    const result=processBatchRows(rows).results[0];
    assert.equal(result.status,'ERROR');
  });

  it('cancellation remains all-or-nothing; no partial batch results returned',()=>{
    const {rows}=importEvidence();
    const controller=new AbortController();controller.abort();
    assert.throws(()=>processBatchRows(rows,{signal:controller.signal}),/BATCH_PROCESSING_CANCELLED/);
  });

  it('export never writes a formula or private market string via user-controlled status',()=>{
    const forged={
      rowNumber:3,market:'=IMPORTXML("private")',itemPrice:30000,
      bestOptionCode:'=cmd',bestOptionName:'=cmd',
      cashOutflow:null,economicCost:null,savingsVsBaseline:null,
      status:'ERROR' as const,errorMessage:'홍길동 010-1234-5678',
    };
    const out=generateBatchExportCsv([forged]);
    assert.ok(!out.includes('=IMPORTXML'));
    assert.ok(!out.includes('=cmd'));
    assert.ok(!out.includes('홍길동'));
    assert.ok(out.includes('UNKNOWN'));
  });
});

describe('S4 | spreadsheet output defense in depth',()=>{
  it('prefixes normalized fullwidth formula operators and zero-width prefixes',()=>{
    for(const v of [
      '\u200B＝SUM(A1:A2)','＋1','－1','＠SUM(A1:A2)',
      ' \uFEFF=1+1','\u00A0=1+1','\t=2+2',
    ]){
      const safe=sanitizeCell(v);
      assert.ok(safe.startsWith("'") || safe.startsWith('"\''));
    }
  });

  it('keeps comma, quote and embedded newline in valid RFC CSV fields',()=>{
    const csv=serializeSafeCsv(['header','second'],[
      ['=SUM(1,2)','he said "hello"\nnext'],
    ]);
    assert.ok(csv.includes('"\'=SUM(1,2)"'));
    assert.ok(csv.includes('"he said ""hello""\nnext"'));
    assert.ok(csv.includes('\r\n'));
  });
});