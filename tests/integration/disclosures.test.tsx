import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { FAQS } from '../../src/content/faq';
import {
  HOW_TO_USE_STEPS,
  LEGAL_DISCLAIMER_TEXT,
  PRIVACY_POLICY_SUMMARY,
  TERMS_OF_SERVICE_DRAFT,
  OPERATOR_DISCLOSURE,
} from '../../src/content/disclosures';
import { CalculatorPage } from '../../src/features/calculator/CalculatorPage';

describe('T18 | FAQ, Disclosures & Operator Policy Integration Contract', () => {
  describe('1. FAQ 구조 및 최소 수량 검증 (최소 8개 이상)', () => {
    it('FAQ 항목은 최소 8개 이상(현재 9개)이어야 한다', () => {
      assert.ok(FAQS.length >= 8);
      assert.equal(FAQS.length, 9);
    });

    it('FAQ는 CALCULATION, LEGAL, OPERATIONAL, PRIVACY 4대 카테고리를 모두 포괄해야 한다', () => {
      const categories = new Set(FAQS.map((f) => f.category));
      assert.ok(categories.has('CALCULATION'));
      assert.ok(categories.has('LEGAL'));
      assert.ok(categories.has('OPERATIONAL'));
      assert.ok(categories.has('PRIVACY'));
    });

    it('모든 FAQ 항목은 검토 승인 상태(reviewStatus: APPROVED)와 승인자를 포함해야 한다', () => {
      for (const faq of FAQS) {
        assert.equal(faq.reviewStatus, 'APPROVED');
        assert.ok(typeof faq.approvedBy === 'string' && faq.approvedBy.length > 0);
        assert.ok(faq.question.startsWith('Q'));
        assert.ok(faq.answer.length > 20);
      }
    });

    it('전자상거래법 관련 법률 FAQ는 법령 출처(legalSource)를 명시해야 한다', () => {
      const legalFaqs = FAQS.filter((f) => f.category === 'LEGAL');
      assert.ok(legalFaqs.length >= 3);
      for (const faq of legalFaqs) {
        if (faq.id === 'faq-02-seller-fault-shipping' || faq.id === 'faq-03-partial-refund-conditions') {
          assert.ok(faq.legalSource && faq.legalSource.includes('전자상거래법'));
        }
      }
    });
  });

  describe('2. 특별 안전조건: 운영자 표시 및 사람 승인(REVIEW_REQUIRED) 강제 검증', () => {
    it('운영자 정보는 실제 법인 정보 부재 시 임의 날조되지 않고 REVIEW_REQUIRED 상태여야 한다', () => {
      assert.equal(OPERATOR_DISCLOSURE.status, 'REVIEW_REQUIRED');
      assert.ok(OPERATOR_DISCLOSURE.companyName.includes('사람 승인 대기'));
      assert.ok(OPERATOR_DISCLOSURE.representative.includes('사람 승인 대기'));
      assert.ok(OPERATOR_DISCLOSURE.businessNumber.includes('사람 승인 대기'));
      assert.ok(OPERATOR_DISCLOSURE.approvalRequiredNote.includes('사람 운영자의 서면 승인'));
    });
  });

  describe('3. 법률 비자문 면책 고지 및 개인정보 미수집 증빙 검증', () => {
    it('법률 면책 고지에 변호사법/세무사법에 따른 법률/세무 자문이 아님을 명시해야 한다', () => {
      assert.ok(LEGAL_DISCLAIMER_TEXT.includes('법률 자문이나 세무사법에 따른 세무 자문을 제공하지 않으며'));
      assert.ok(LEGAL_DISCLAIMER_TEXT.includes('의사결정 참고용 시뮬레이션'));
    });

    it('개인정보 처리방침에 No-PII 및 100% 브라우저 로컬 연산이 명시되어야 한다', () => {
      assert.ok(PRIVACY_POLICY_SUMMARY.includes('개인 식별 정보(PII) 미수집 원칙'));
      assert.ok(PRIVACY_POLICY_SUMMARY.includes('100% 브라우저 로컬 연산'));
      assert.ok(PRIVACY_POLICY_SUMMARY.includes('현재 무료 버전의 별도 추적 코드 없음'));
    });

    it('이용 가이드는 4단계로 구성되어야 한다', () => {
      assert.equal(HOW_TO_USE_STEPS.length, 4);
      assert.equal(HOW_TO_USE_STEPS[0].step, 1);
      assert.equal(HOW_TO_USE_STEPS[3].step, 4);
    });

    it('이용약관 초안이 정의되어 있어야 한다', () => {
      assert.ok(TERMS_OF_SERVICE_DRAFT.includes('ReturnWise 무료 서비스 이용약관 (초안)'));
    });
  });

  describe('4. CalculatorPage 내 FAQ 및 운영자 고지 렌더링 검증', () => {
    it('메인 페이지 렌더링 시 FAQ 9종, 이용 가이드 4단계, 법률 면책 고지, 운영자 상태 배지가 모두 표시되어야 한다', () => {
      const html = renderToStaticMarkup(<CalculatorPage />);

      // Navigation links
      assert.ok(html.includes('사용 방법'));
      assert.ok(html.includes('고지·운영자'));

      // How to use section
      assert.ok(html.includes('계산기 이용 가이드'));
      assert.ok(html.includes('STEP 1'));
      assert.ok(html.includes('STEP 4'));

      // FAQ section
      assert.ok(html.includes('자주 묻는 질문 &amp; 2026 전자상거래법 가이드라인 (FAQ)'));
      assert.ok(html.includes('Q1. &#x27;순경제비용&#x27;과 &#x27;추가 현금지출&#x27;은 어떻게 다르고'));
      assert.ok(html.includes('Q9. ReturnWise의 계산 결과와 추천은 법적 효력이 있는 자문인가요?'));

      // Operator & Legal section
      assert.ok(html.includes('법률 비자문 면책 고지 및 운영자 정보'));
      assert.ok(html.includes('REVIEW_REQUIRED'));
      assert.ok(html.includes('사람 승인 대기'));
    });
  });
});
