/**
 * ReturnWise Pro Validation & Unit Economics Contract Tests (tests/e2e/pro_validation.spec.ts)
 * Verifies willingness-to-pay research, 3 price tiers, no-actual-charge disclosures,
 * objections analysis, target 5 buyers benchmark, PRO_BUILD_LOCKED gate, and unit economics integrity.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 대기명단과 매출을 혼동 금지 (Waitlist != Revenue).
 * 2. 무단 광고성 메일 금지 (Anti-Spam compliance).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T31 | Pro Validation & Unit Economics Contract', () => {
  describe('1. Pro 지불 의사 검증 보고서 검증 (docs/PRO_VALIDATION.md)', () => {
    const reportPath = path.resolve('docs/PRO_VALIDATION.md');

    it('docs/PRO_VALIDATION.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(reportPath), 'docs/PRO_VALIDATION.md 파일이 존재해야 합니다.');
    });

    it('Pro 개발 착수가 PRO_BUILD_LOCKED 로 차단되어 있어야 한다 (증빙 전 개발 금지)', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('PRO_BUILD_LOCKED'),
        '사전 증빙 없는 Pro 개발을 차단하는 PRO_BUILD_LOCKED 가 명시되어야 합니다.'
      );
    });

    it('CSV 일괄, 이력 저장, 월간 리포트 3대 유료 기능 선호도가 포함되어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('CSV 일괄 계산'), 'CSV 일괄 기능이 포함되어야 합니다.');
      assert.ok(content.includes('반품 이력 보존'), '이력 보존 대시보드가 포함되어야 합니다.');
      assert.ok(content.includes('월간 세무/정산 리포트'), '월간 리포트가 포함되어야 합니다.');
    });

    it('월 9900원, 14900원, 19900원 3단계 가격 제시가 포함되어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('9,900원'), '9,900원 티어가 포함되어야 합니다.');
      assert.ok(content.includes('14,900원'), '14,900원 티어가 포함되어야 합니다.');
      assert.ok(content.includes('19,900원'), '19,900원 티어가 포함되어야 합니다.');
    });

    it('실제 결제 없음과 대기 신청의 차이가 명확히 고지되어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('실제 결제가 이루어지지 않으며') || content.includes('실제 결제 없음'),
        '결제 없음과 대기 신청 분리 고지가 명시되어야 합니다.'
      );
    });

    it('반대 의견 및 지불 저항 요인이 분석되어 있어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(content.includes('반대 의견 1') || content.includes('지불 저항'), '반대 의견 분석이 수록되어야 합니다.');
    });

    it('구매의사 명시적 대상 5명 목표가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('5명') || content.includes('Target Committed Buyers'),
        '5명 목표 기준이 명시되어야 합니다.'
      );
    });

    it('대기명단과 매출을 혼동 금지 안전조건이 수록되어야 한다 (특별 안전조건 1)', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('대기명단과 매출') && content.includes('금지'),
        '대기명단과 매출 혼동 금지 안전조건이 명시되어야 합니다.'
      );
    });

    it('무단 광고성 메일 전송 금지 안전조건이 수록되어야 한다 (특별 안전조건 2)', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('무단 광고성 메일') && content.includes('금지'),
        '무단 광고성 메일 전송 금지 안전조건이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 단위 경제 분석표 검증 (docs/UNIT_ECONOMICS.csv)', () => {
    const csvPath = path.resolve('docs/UNIT_ECONOMICS.csv');

    it('docs/UNIT_ECONOMICS.csv 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(csvPath), 'docs/UNIT_ECONOMICS.csv 파일이 존재해야 합니다.');
    });

    it('헤더에 PG수수료, 원가, 마진율, LTV/CAC 컬럼이 포함되어야 한다', () => {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const header = content.trim().split('\n')[0];
      assert.ok(header.includes('tier_name'));
      assert.ok(header.includes('monthly_price_krw'));
      assert.ok(header.includes('pg_fee_total_krw'));
      assert.ok(header.includes('total_cogs_per_user_krw'));
      assert.ok(header.includes('gross_margin_pct'));
      assert.ok(header.includes('ltv_to_cac_ratio'));
    });

    it('Starter, Pro, Business 3개 티어가 정의되고 마진율이 80% 이상이어야 한다', () => {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.trim().split('\n').slice(1);
      assert.strictEqual(lines.length, 3, '티어는 정확히 3개여야 합니다.');

      for (const line of lines) {
        const parts = line.split(',');
        const tier = parts[0];
        const marginStr = parts[9]; // gross_margin_pct
        const margin = parseFloat(marginStr.replace('%', ''));
        assert.ok(margin >= 80.0, `${tier} 마진율은 80% 이상이어야 합니다: ${margin}%`);
        const ltvCac = parseFloat(parts[13]); // ltv_to_cac_ratio
        assert.ok(ltvCac >= 3.0, `${tier} LTV/CAC 비율은 3.0 이상이어야 합니다: ${ltvCac}`);
      }
    });
  });
});
