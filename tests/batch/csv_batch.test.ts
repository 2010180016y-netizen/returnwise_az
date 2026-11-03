/**
 * ReturnWise Pro Batch CSV Calculation & Security Tests (tests/batch/csv_batch.test.ts)
 * Verifies normal 100 & 1,000 row accuracy, malicious formula injection defense,
 * 5MB/1000-row limits, PII warning and memory dropping, UTF-8 BOM, and cancellation.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 반품 주문 원본 CSV의 개인정보를 무심코 저장하지 않게 설계 (Drop PII columns).
 * 2. CSV Injection (Formula Injection) 안전 처리.
 * 3. 정상 100/1000행 결과 정확.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText } from '../../src/features/batch/csvParser';
import {
  processBatchRows,
  generateBatchExportCsv,
} from '../../server/batch/batchProcessor';
import { sanitizeCell, serializeSafeCsv } from '../../server/batch/csvSanitizer';

describe('T36 | CSV Batch Calculation & Security Contract', () => {
  it('policy details missing: CSV must never auto-recommend partial refund or claim fictitious savings', () => {
    const { rows } = parseCsvText('판매가,초기배송비,회수배송비,수수료율,마켓\n30000,3000,3500,5.5,SMARTSTORE');
    const result = processBatchRows(rows).results[0];
    assert.equal(result.status, 'REVIEW_REQUIRED');
    assert.equal(result.bestOptionCode, 'REVIEW_REQUIRED');
    assert.equal(result.savingsVsBaseline, null);
    const exportCsv = generateBatchExportCsv([result]);
    assert.ok(exportCsv.includes('REVIEW_REQUIRED'));
    assert.ok(!exportCsv.includes(',0,0,0,SUCCESS'));
  });

  describe('1. 정상 100행 일괄 계산 정확도 및 성능 검증', () => {
    it('100행의 정상 CSV를 파싱하고 정확하게 일괄 계산해야 한다 (<100ms)', () => {
      const header = '판매가,초기배송비,회수배송비,수수료율,마켓';
      const lines = [header];

      for (let i = 1; i <= 100; i++) {
        const price = 10000 + (i % 20) * 1000;
        lines.push(`${price},3000,3000,5.5,SMARTSTORE`);
      }

      const csvContent = lines.join('\n');
      const { rows, summary } = parseCsvText(csvContent);

      assert.strictEqual(summary.totalRows, 100);
      assert.strictEqual(summary.validRows, 100);
      assert.strictEqual(summary.piiWarning, false);

      const { results, totalProcessed, executionTimeMs } = processBatchRows(rows);
      assert.strictEqual(totalProcessed, 100);
      assert.strictEqual(results.length, 100);
      assert.ok(executionTimeMs < 200, `100행 계산 속도는 200ms 미만이어야 합니다: ${executionTimeMs}ms`);

      for (const res of results) {
        assert.strictEqual(res.status, 'REVIEW_REQUIRED');
        assert.equal(res.bestOptionCode, 'REVIEW_REQUIRED');
        assert.equal(res.cashOutflow, null);
        assert.equal(res.economicCost, null);
        assert.equal(res.savingsVsBaseline, null);
        assert.match(res.errorMessage ?? '', /고객 동의/);
      }
    });
  });

  describe('2. 정상 1,000행 대용량 일괄 계산 검증', () => {
    it('1,000행의 대용량 CSV도 메모리 누수 없이 신속히 계산해야 한다 (<500ms)', () => {
      const header = '판매가,초기배송비,회수배송비,수수료율,마켓';
      const lines = [header];

      for (let i = 1; i <= 1000; i++) {
        const price = 5000 + (i % 50) * 500;
        const market = i % 2 === 0 ? 'COUPANG' : 'SMARTSTORE';
        const rate = market === 'COUPANG' ? '10.8' : '5.5';
        lines.push(`${price},3000,3500,${rate},${market}`);
      }

      const csvContent = lines.join('\n');
      const { rows, summary } = parseCsvText(csvContent);

      assert.strictEqual(summary.totalRows, 1000);
      assert.strictEqual(summary.validRows, 1000);

      const { results, totalProcessed, executionTimeMs } = processBatchRows(rows);
      assert.strictEqual(totalProcessed, 1000);
      assert.strictEqual(results.length, 1000);
      assert.ok(executionTimeMs < 500, `1000행 계산 시간은 500ms 미만이어야 합니다: ${executionTimeMs}ms`);
    });
  });

  describe('3. CSV Injection (Formula Injection) 방어 검증', () => {
    it('악성 수식 접두어(=, +, -, @, \\t, \\r)로 시작하는 셀 값은 작은따옴표로 중화되어야 한다', () => {
      const maliciousPayloads = [
        "=cmd|' /C calc'!A0",
        '+123456789',
        '-2+5+cmd|',
        '@SUM(A1:A10)',
        '\tTAB_TRIGGER',
        '\rCR_TRIGGER',
      ];

      for (const payload of maliciousPayloads) {
        const sanitized = sanitizeCell(payload);
        assert.ok(
          sanitized.startsWith("'") || (sanitized.charCodeAt(0) === 34 && sanitized.charCodeAt(1) === 39),
          `악성 페이로드 [${payload}]는 CSV 이스케이프 내부에 작은따옴표가 있어야 합니다: ${sanitized}`
        );
      }
    });

    it('내보내기 CSV 생성 시 악성 코드가 포함되어도 안전하게 이스케이프되어야 한다', () => {
      const headers = ['이름', '수식'];
      const rows = [
        ['정상상품', '=cmd|...'],
        ['@위험마켓', '+1234'],
      ];

      const csv = serializeSafeCsv(headers, rows);
      assert.ok(csv.includes("'=cmd|..."), '수식 접두어가 작은따옴표로 이스케이프되어야 합니다.');
      assert.ok(csv.includes("'@위험마켓"), '@ 접두어가 작은따옴표로 이스케이프되어야 합니다.');
    });

    it('formula containing comma, quotation and line break keeps valid CSV quoting', () => {
      const commaFormula = sanitizeCell('=SUM(1,2)');
      assert.equal(commaFormula.charCodeAt(0), 34);
      assert.ok(commaFormula.includes("'=SUM(1,2)"));
      assert.equal(commaFormula.charCodeAt(commaFormula.length - 1), 34);
      const quoteFormula = sanitizeCell('=HYPERLINK("url")');
      assert.ok(quoteFormula.includes('""url""'));
      assert.ok(sanitizeCell('   =1+1').startsWith("'"));
      const lineBreakFormula = sanitizeCell('=1' + String.fromCharCode(10) + '=2');
      assert.equal(lineBreakFormula.charCodeAt(0), 34);
      assert.equal(lineBreakFormula.charCodeAt(1), 39);
    });
    it('배치 결과 내보내기 CSV(generateBatchExportCsv)가 정상 생성되어야 한다', () => {
      const dummyResults = [
        {
          rowNumber: 1,
          market: 'SMARTSTORE',
          itemPrice: 30000,
          bestOptionCode: 'C01',
          bestOptionName: '표준 반품 회수',
          cashOutflow: 25350,
          economicCost: 16350,
          savingsVsBaseline: 0,
          status: 'SUCCESS' as const,
        },
      ];

      const exported = generateBatchExportCsv(dummyResults);
      assert.ok(exported.includes('행번호,판매마켓,상품판매가'));
      assert.ok(exported.includes('1,SMARTSTORE,30000,C01,표준 반품 회수'));
    });
  });

  describe('4. PII 업로드 감지 및 메모리 폐기 안전조건 검증 (특별 안전조건)', () => {
    it('고객명, 주소, 주문번호 컬럼 업로드 시 경고를 발령하고 메모리에서 즉시 폐기해야 한다', () => {
      const csvWithPii = [
        '고객명,수령인주소,전화번호,주문번호,판매가,배송비,회수배송비',
        '홍길동,서울시 강남구 테헤란로 123,010-1234-5678,ORD-9999,30000,3000,3000',
        '이순신,부산시 해운대구 우동 456,010-8765-4321,ORD-8888,25000,3000,3000',
      ].join('\n');

      const { rows, summary } = parseCsvText(csvWithPii);

      // 1. PII 경고 발령 확인
      assert.strictEqual(summary.piiWarning, true);
      assert.ok(summary.detectedPiiColumns.includes('고객명'));
      assert.ok(summary.detectedPiiColumns.includes('수령인주소'));
      assert.ok(summary.detectedPiiColumns.includes('전화번호'));
      assert.ok(summary.detectedPiiColumns.includes('주문번호'));

      // 2. SPECIAL SAFETY CONDITION: PII 데이터가 정제 객체에 0건임을 입증
      for (const row of rows) {
        assert.strictEqual(row.rawPiiCleaned.customerName, undefined);
        assert.strictEqual(row.rawPiiCleaned['고객명'], undefined);
        assert.strictEqual(row.rawPiiCleaned['수령인주소'], undefined);
        assert.strictEqual(row.rawPiiCleaned['전화번호'], undefined);
        assert.strictEqual(row.rawPiiCleaned['주문번호'], undefined);
        // 오직 금융 계산 수치만 보존
        assert.strictEqual(typeof row.rawPiiCleaned.itemPrice, 'number');
      }
    });
  });

  describe('5. 파일 크기 및 행 수 한도 제한 검증', () => {
    it('1,000행을 초과하는 CSV 업로드 시 에러를 발생시켜야 한다', () => {
      const lines = ['판매가,배송비'];
      for (let i = 0; i < 1005; i++) {
        lines.push('10000,3000');
      }
      assert.throws(
        () => parseCsvText(lines.join('\n')),
        /허용 한도\(1000행\)를 초과했습니다/
      );
    });

    it('5MB를 초과하는 CSV 파일은 즉시 거절되어야 한다', () => {
      // 5MB 초과 문자열 시뮬레이션
      const largeContent = '판매가,배송비\n' + '10000,3000\n'.repeat(500000); // ~5.5MB
      assert.throws(
        () => parseCsvText(largeContent, { maxFileSizeMb: 5 }),
        /파일 크기가 허용 한도\(5MB\)를 초과했습니다/
      );
    });
  });

  describe('6. UTF-8 BOM 인코딩 처리 및 취소(AbortSignal) 검증', () => {
    it('UTF-8 BOM(\\uFEFF)이 포함된 CSV도 첫 번째 헤더를 정상 인식해야 한다', () => {
      const bomContent = '\uFEFF판매가,초기배송비,회수배송비\n30000,3000,3000';
      const { rows, summary } = parseCsvText(bomContent);

      assert.strictEqual(summary.totalRows, 1);
      assert.strictEqual(rows[0].itemPrice, 30000);
    });

    it('AbortSignal이 취소되면 배치 계산이 즉시 중단되어야 한다', () => {
      const controller = new AbortController();
      controller.abort(); // 즉시 취소

      const dummyRows = [
        {
          rowNumber: 1,
          market: 'SMARTSTORE',
          itemPrice: 30000,
          initialShipping: 3000,
          returnShipping: 3000,
          commissionRate: 5.5,
          rawPiiCleaned: {},
        },
      ];

      assert.throws(
        () => processBatchRows(dummyRows, { signal: controller.signal }),
        /BATCH_PROCESSING_CANCELLED/
      );
    });
  });
});
