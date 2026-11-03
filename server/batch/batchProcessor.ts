/**
 * S4 conservative batch decision-support processor.
 * No estimated costs, fabricated consent, platform checks or legal certification.
 * Fully provided USER-ATTESTED cost/policy fields produce conditional estimates.
 */
import type { BatchRowInput, BatchRowResult, AttestedBatchScenario } from '../../src/features/batch/types';
import { compareAlternatives } from '../../src/domain/compare';
import type { ScenarioInput } from '../../src/domain/types';
import { serializeSafeCsv } from './csvSanitizer';

const VALID_MARKETS = new Set(['SMARTSTORE','COUPANG','INDEPENDENT']);
const CODE_MAP: Record<string,string> = {
  RETURN_FULL:'C01',KEEP_FULL:'C02',KEEP_PARTIAL:'C03',EXCHANGE:'C15',
};
const DISPLAY_NAMES: Record<string,string> = {
  C01:'표준 반품 회수',C02:'회수 없는 전액환급',
  C03:'자발적 합의 부분환급',C15:'1:1 교환',
};
const COST_FIELDS: Array<keyof ScenarioInput> = [
  'refundAmount','reverseShippingSellerCost','reverseShippingBuyerCost',
  'handlingCost','recoveredItemNetValue','feeReversalCredit','additionalSellerCost',
];

function strictFinancialRow(row: BatchRowInput): boolean {
  return typeof row.itemPrice === 'number' && Number.isSafeInteger(row.itemPrice) &&
    row.itemPrice > 0 &&
    typeof row.initialShipping === 'number' && Number.isSafeInteger(row.initialShipping) &&
    row.initialShipping >= 0 &&
    typeof row.returnShipping === 'number' && Number.isSafeInteger(row.returnShipping) &&
    row.returnShipping >= 0 &&
    typeof row.commissionRate === 'number' &&
    Number.isFinite(row.commissionRate) && row.commissionRate >= 0 &&
    row.commissionRate <= 100 && VALID_MARKETS.has(row.market);
}

function attestationIsComplete(row: BatchRowInput, item: AttestedBatchScenario): boolean {
  const {inputs,flags} = item;
  const market = row.market==='SMARTSTORE'?'NAVER':row.market==='COUPANG'?'COUPANG':'INDEPENDENT';
  if (!inputs || !flags || flags.platform!==market ||
      !['BUYER_REMORSE','SELLER_FAULT','DEFECT_OR_DIFF'].includes(flags.reason) ||
      !['REFUND','EXCHANGE'].includes(flags.buyerRequest) ||
      typeof flags.policyReviewed!=='boolean' ||
      typeof flags.rightsReviewed!=='boolean' ||
      typeof flags.isSpecialItem!=='boolean' ||
      typeof flags.isPolicyOutdated!=='boolean' ||
      inputs.reverseShippingSellerCost!==row.returnShipping) return false;

  for(const key of COST_FIELDS) {
    const val=inputs[key];
    if(typeof val!=='number' || !Number.isSafeInteger(val) ||
        val<0 || val>1_000_000_000_000) return false;
  }
  const optionalCosts: Array<keyof ScenarioInput> = [
    'agreedPartialRefund','replacementCost','replacementOutboundShipping',
  ];
  for(const key of optionalCosts) {
    const val=inputs[key];
    if(val!==undefined && (typeof val!=='number' ||
        !Number.isSafeInteger(val) || val<0 || val>1_000_000_000_000)) return false;
  }
  if((inputs.refundAmount ?? 0)<=0 || inputs.feeReversalCredit! > inputs.refundAmount!) return false;
  return true;
}

function resultRow(row: BatchRowInput, status: BatchRowResult['status'], message:string):BatchRowResult {
  return {
    rowNumber:row.rowNumber,
    market:VALID_MARKETS.has(row.market)?row.market:'UNKNOWN',
    itemPrice:typeof row.itemPrice==='number' && Number.isSafeInteger(row.itemPrice)?row.itemPrice:null,
    bestOptionCode:status==='ERROR'?'ERROR':'REVIEW_REQUIRED',
    bestOptionName:status==='ERROR'?'입력 검증 실패':'처리 조건 확인 필요',
    cashOutflow:null,economicCost:null,savingsVsBaseline:null,
    status,errorMessage:message,
  };
}

export function processBatchRows(
  rows: BatchRowInput[],
  options: { signal?: AbortSignal } = {}
): { results: BatchRowResult[]; totalProcessed: number; executionTimeMs: number } {
  const start=Date.now();
  if(!Array.isArray(rows) || rows.length>1000) throw new Error('BATCH_LIMIT_EXCEEDED');
  const results:BatchRowResult[]=[];
  for(const row of rows) {
    if(options.signal?.aborted) throw new Error('BATCH_PROCESSING_CANCELLED: 작업이 취소되었습니다.');
    if(!row || (row.validationErrors?.length ?? 0)>0 || !strictFinancialRow(row)) {
      results.push(resultRow(row ?? {
        rowNumber:results.length+2,market:'UNKNOWN',itemPrice:null,
        initialShipping:null,returnShipping:null,commissionRate:null,rawPiiCleaned:{},
      },'ERROR','올바른 판매가·배송비·수수료율·마켓 코드를 확인해 주세요.'));
      continue;
    }
    if(!row.attestedScenario) {
      results.push(resultRow(row,'REVIEW_REQUIRED',
        '고객 동의·마켓 정책·법정 권리 및 모든 실제 비용 근거를 확인해야 합니다.'));
      continue;
    }
    if(!attestationIsComplete(row,row.attestedScenario)) {
      results.push(resultRow(row,'ERROR','실제 비용 및 확인 상태의 정합성이 맞지 않습니다.'));
      continue;
    }
    const {inputs,flags}=row.attestedScenario;
    // An exchange request must not be silently replaced with a refund recommendation.
    if(flags.buyerRequest!=='REFUND') {
      results.push(resultRow(row,'REVIEW_REQUIRED',
        '고객의 교환 요청은 별도 비교 그룹이며 환불 대안을 자동 추천하지 않습니다.'));
      continue;
    }
    if(!flags.policyReviewed || !flags.rightsReviewed || flags.isPolicyOutdated) {
      results.push(resultRow(row,'REVIEW_REQUIRED',
        '마켓 정책·소비자 권리·최신 정책 확인이 완료되지 않았습니다.'));
      continue;
    }
    const comparison=compareAlternatives(inputs,flags,'ECONOMIC_COST');
    // Exchange belongs to a different decision category. Never select it
    // as the lowest-cost alternative across refund and exchange groups.
    const refundable=comparison.refundGroup.filter(
      opt=>opt.status==='ELIGIBLE' && opt.rankingEligible
    );
    const baseline=refundable.find(x=>x.alternative==='RETURN_FULL');
    if(refundable.length<2 || !baseline) {
      results.push(resultRow(row,'REVIEW_REQUIRED',
        '비교할 적격 환급 방식이 2개 미만이거나 기준 환급 방식이 확인되지 않았습니다.'));
      continue;
    }
    const sorted=[...refundable].sort((a,b)=>
      a.economicCost-b.economicCost ||
      a.cashOutflow-b.cashOutflow ||
      a.alternative.localeCompare(b.alternative)
    );
    const best=sorted[0];
    const saving=baseline.economicCost-best.economicCost;
    if (![best.cashOutflow,best.economicCost,saving].every(Number.isSafeInteger) ||
        saving<0 || !CODE_MAP[best.alternative]) {
      results.push(resultRow(row,'ERROR','계산 결과의 정수 정확성을 확인해야 합니다.'));
      continue;
    }
    results.push({
      rowNumber:row.rowNumber,market:row.market,itemPrice:row.itemPrice,
      bestOptionCode:CODE_MAP[best.alternative],
      bestOptionName:DISPLAY_NAMES[CODE_MAP[best.alternative]] + ' (사용자 확인 기준)',
      cashOutflow:best.cashOutflow,economicCost:best.economicCost,
      savingsVsBaseline:saving,status:'ESTIMATE_ONLY',
      errorMessage:'사용자가 제공한 비용·정책 확인을 전제로 한 비교이며 법적 적합성을 보증하지 않습니다.',
    });
  }
  return {results,totalProcessed:results.length,executionTimeMs:Date.now()-start};
}

/** Only whitelisted scalar fields reach the export; never echo CSV raw cells. */
export function generateBatchExportCsv(results: BatchRowResult[]): string {
  const headers=[
    '행번호','판매마켓','상품판매가','최적대안코드','추천처리방식',
    '추가현금지출','순경제적손실','기준안대비절감액','계산상태','검토사항',
  ];
  const allowedStatus=new Set(['ESTIMATE_ONLY','SUCCESS','REVIEW_REQUIRED','ERROR']);
  const rows=results.map(r=>{
    const status=allowedStatus.has(r.status)?r.status:'ERROR';
    const code=(r.bestOptionCode in DISPLAY_NAMES)?r.bestOptionCode:
      status==='ERROR'?'ERROR':'REVIEW_REQUIRED';
    const name=(status==='ESTIMATE_ONLY'||status==='SUCCESS')?
      (DISPLAY_NAMES[code]??'처리 조건 확인 필요'):
      status==='ERROR'?'입력 검증 실패':'처리 조건 확인 필요';
    return [
      Number.isSafeInteger(r.rowNumber)?r.rowNumber:'',
      VALID_MARKETS.has(r.market)?r.market:'UNKNOWN',
      r.itemPrice!==null&&Number.isSafeInteger(r.itemPrice)?r.itemPrice:'',
      code,name,
      r.cashOutflow!==null&&Number.isSafeInteger(r.cashOutflow)?r.cashOutflow:'',
      r.economicCost!==null&&Number.isSafeInteger(r.economicCost)?r.economicCost:'',
      r.savingsVsBaseline!==null&&Number.isSafeInteger(r.savingsVsBaseline)?r.savingsVsBaseline:'',
      status,
      status==='ESTIMATE_ONLY'?'사용자 확인 정보에 따른 조건부 추정':
      status==='ERROR'?'입력 검증 실패':
      status==='REVIEW_REQUIRED'?'정책·비용 근거 확인 필요':'기존 결과',
    ];
  });
  return serializeSafeCsv(headers,rows);
}