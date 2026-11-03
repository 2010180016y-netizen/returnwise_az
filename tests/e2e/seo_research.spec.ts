/**
 * ReturnWise SEO Research & High-Quality Content Contract Tests (tests/e2e/seo_research.spec.ts)
 * Verifies SEO keyword prioritization, Search Console baseline integrity,
 * competitor analysis, and 5 original merchant guides with realistic scenarios, formulas, legal notices, and CTAs.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 확인 없이 경쟁 검색량과 트래픽 예측을 사실로 보고 금지.
 * 2. 품질 체크리스트 5종 PASS (사례/산식/법적고지/CTA/No-AI 중복).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { allGuides, getGuideBySlug } from '../../src/content/guides/index';

describe('T30 | SEO Research & High-Quality Content Contract', () => {
  describe('1. 검색 수요 조사 보고서 검증 (docs/SEO_RESEARCH.md)', () => {
    const researchPath = path.resolve('docs/SEO_RESEARCH.md');

    it('docs/SEO_RESEARCH.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(researchPath), 'docs/SEO_RESEARCH.md 파일이 존재해야 합니다.');
    });

    it('10~20개의 핵심 키워드 매트릭스가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(researchPath, 'utf-8');
      assert.ok(content.includes('K01') && content.includes('스마트스토어 반품 배송비 계산'));
      assert.ok(content.includes('K02') && content.includes('쿠팡 반품 배송비 판매자 부담'));
      assert.ok(content.includes('K03') && content.includes('반품 회수포기 기준'));
      assert.ok(content.includes('K15') && content.includes('온라인 쇼핑몰 반품률 관리'));
    });

    it('검색량 측정 가능 여부(도구 실측 vs 추정치)가 명확히 구분되어야 한다', () => {
      const content = fs.readFileSync(researchPath, 'utf-8');
      assert.ok(
        content.includes('측정 가능') || content.includes('추정치'),
        '측정 가능 여부 구분이 명시되어야 합니다.'
      );
    });

    it('Search Console 실적 베이스라인이 0에서 시작하는 실제 관측치로 기록되어야 한다', () => {
      const content = fs.readFileSync(researchPath, 'utf-8');
      assert.ok(
        content.includes('노출: 0회') && content.includes('클릭: 0회'),
        'Search Console 베이스라인 수치가 정직하게 0회로 기록되어야 합니다.'
      );
    });

    it('확인 없는 검색량과 트래픽 예측을 사실로 보고하는 것을 금지해야 한다 (특별 안전조건)', () => {
      const content = fs.readFileSync(researchPath, 'utf-8');
      assert.ok(
        content.includes('날조 금지') || content.includes('확인되지 않은 경쟁 검색량'),
        '트래픽 날조 금지 안전조건이 수록되어야 합니다.'
      );
    });

    it('경쟁 검색결과 수동 분석(카페, 오픈마켓, 엑셀)이 포함되어야 한다', () => {
      const content = fs.readFileSync(researchPath, 'utf-8');
      assert.ok(content.includes('네이버 셀러 카페'), '카페/블로그 경쟁 분석이 포함되어야 합니다.');
      assert.ok(content.includes('오픈마켓 공식 매뉴얼'), '공식 매뉴얼 분석이 포함되어야 합니다.');
      assert.ok(content.includes('일반 엑셀 템플릿'), '엑셀 템플릿 한계 분석이 포함되어야 합니다.');
    });
  });

  describe('2. 5대 고품질 가이드 콘텐츠 계약 검증 (src/content/guides/)', () => {
    it('총 5개의 고품질 가이드가 정의되어 있어야 한다', () => {
      assert.strictEqual(allGuides.length, 5, '가이드는 정확히 5종이어야 합니다.');
    });

    it('각 가이드는 독창적 실무 사례(scenario)를 갖추어야 한다', () => {
      for (const guide of allGuides) {
        assert.ok(guide.realisticScenario.title.length > 5, `${guide.id} 사례 제목이 유효해야 합니다.`);
        assert.ok(guide.realisticScenario.description.length > 20, `${guide.id} 사례 설명이 충분해야 합니다.`);
        assert.ok(guide.realisticScenario.itemPrice > 0, `${guide.id} 상품가가 0보다 커야 합니다.`);
      }
    });

    it('각 가이드는 1원 단위 대수 산식(exactFormulaMath)을 포함해야 한다', () => {
      for (const guide of allGuides) {
        assert.ok(guide.exactFormulaMath.stepByStepFormula.length >= 3, `${guide.id} 단계별 수식이 3개 이상이어야 합니다.`);
        assert.ok(guide.exactFormulaMath.calculationResult.cashOutflow > 0, `${guide.id} 현금 지출 결과가 있어야 합니다.`);
        assert.ok(guide.exactFormulaMath.calculationResult.economicCost > 0, `${guide.id} 순경제손실 결과가 있어야 합니다.`);
      }
    });

    it('각 가이드는 2026 전자상거래법 법률 고지(legalComplianceNotice)를 포함해야 한다', () => {
      for (const guide of allGuides) {
        assert.ok(guide.legalComplianceNotice.statute.includes('전자상거래법'), `${guide.id} 법령명이 명시되어야 합니다.`);
        assert.ok(guide.legalComplianceNotice.provisions.length >= 1, `${guide.id} 조항이 포함되어야 합니다.`);
        assert.ok(guide.legalComplianceNotice.cautions.length > 10, `${guide.id} 법률 주의사항이 포함되어야 합니다.`);
      }
    });

    it('각 가이드는 ReturnWise 계산기로 연결되는 CTA(callToAction)를 갖추어야 한다', () => {
      for (const guide of allGuides) {
        assert.ok(guide.callToAction.buttonLabel.length > 3, `${guide.id} CTA 버튼 레이블이 있어야 합니다.`);
        assert.strictEqual(guide.callToAction.targetPath, '/', `${guide.id} CTA 타깃은 루트 계산기여야 합니다.`);
      }
    });

    it('5개 가이드 전원이 qualityPass === true 상태여야 한다', () => {
      for (const guide of allGuides) {
        assert.strictEqual(guide.qualityPass, true, `${guide.id} 품질 체크리스트 통과여야 합니다.`);
      }
    });

    it('slug를 통한 개별 가이드 조회가 정상 동작해야 한다', () => {
      const guide = getGuideBySlug('smartstore-return-shipping-guide');
      assert.ok(guide, 'smartstore-return-shipping-guide 가 조회가 되어야 합니다.');
      assert.strictEqual(guide?.targetKeyword, '스마트스토어 반품 배송비 계산');
    });
  });
});
