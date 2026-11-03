/**
 * ReturnWise Calculator Main Page (src/features/calculator/CalculatorPage.tsx)
 * 1-Page responsive financial & legal decision tool.
 */

import React, { useState } from 'react';
import { useCalculatorState } from './useCalculatorState';
import { InputForm } from './InputForm';
import { ResultView } from './ResultView';
import { Actions } from './Actions';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
} from '../../components';
import { AlternativeCode } from '../../domain/types';
import { FAQS } from '../../content/faq';
import {
  HOW_TO_USE_STEPS,
  LEGAL_DISCLAIMER_TEXT,
  PRIVACY_POLICY_SUMMARY,
  TERMS_OF_SERVICE_DRAFT,
  OPERATOR_DISCLOSURE,
} from '../../content/disclosures';

export const CalculatorPage: React.FC = () => {
  const {
    rawInputs,
    flags,
    metric,
    inputErrors,
    parsedInputs,
    comparisonResult,
    setMetric,
    updateRawInput,
    updateFlag,
    loadExampleC01,
    loadExampleC03,
    resetAll,
  } = useCalculatorState();

  const [expandedBreakdown, setExpandedBreakdown] = useState<AlternativeCode | null>(null);

  const toggleBreakdown = (alt: AlternativeCode) => {
    setExpandedBreakdown((prev) => (prev === alt ? null : alt));
  };

  return (
    <div className="rw-stack-lg" style={{ paddingBottom: '4rem' }}>
      {/* 1. Header & Navigation */}
      <header className="rw-flex-between" style={{ borderBottom: '1px solid var(--color-slate-200)', paddingBottom: '1rem' }}>
        <div>
          <div className="rw-flex" style={{ gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-600)' }}>
              ReturnWise
            </span>
            <Badge variant="neutral">무료 MVP</Badge>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)' }}>
            소규모 이커머스 판매자를 위한 반품·환불·교환 의사결정 계산기
          </span>
        </div>
        <nav className="rw-flex" style={{ gap: '0.75rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
          <a href="#how-to-use" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>사용 방법</a>
          <a href="#step-context" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>1. 상황 확인</a>
          <a href="#step-inputs" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>2. 비용 입력</a>
          <a href="#step-results" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>3. 대안 비교</a>
          <a href="#faq" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>FAQ</a>
          <a href="#operator" style={{ color: 'var(--color-slate-600)', textDecoration: 'none' }}>고지·운영자</a>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <section className="rw-stack-sm" style={{ textAlign: 'center', padding: '1rem 0' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
          반품 한 건, 실제로 얼마가 더 들까요?
        </h1>
        <p style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--color-slate-600)', fontSize: '0.9375rem' }}>
          2026 전자상거래법과 마켓 규정을 침해하지 않는 허용된 처리 방식별{' '}
          <strong>추가 현금 지출</strong>과 <strong>순경제적 비용</strong>을 30초 내에 투명하게 대조합니다.
        </p>
      </section>

      {/* Global Warnings Banner */}
      {comparisonResult.globalWarnings.length > 0 && (
        <div className="rw-stack-sm">
          {comparisonResult.globalWarnings.map((warning, idx) => (
            <Alert key={idx} type="warning" title="주의 및 안전 모드 안내">
              {warning}
            </Alert>
          ))}
        </div>
      )}

      {/* 2.5 Quick Actions & Anonymous Report Export (T17) */}
      <Actions
        inputs={parsedInputs}
        flags={flags}
        comparison={comparisonResult}
        onLoadExampleC01={loadExampleC01}
        onLoadExampleC03={loadExampleC03}
        onResetAll={resetAll}
      />

      {/* 2.8 How To Use Steps (T18) */}
      <section id="how-to-use" className="rw-card" style={{ background: 'var(--color-slate-50)' }}>
        <CardHeader>
          <CardTitle>📖 계산기 이용 가이드</CardTitle>
          <CardDescription>
            복잡한 반품 상황을 4단계로 나누어 안전하게 최적 대안을 도출합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rw-grid-2" style={{ gap: '1rem' }}>
            {HOW_TO_USE_STEPS.map((step) => (
              <div
                key={step.step}
                style={{
                  background: '#FFFFFF',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-slate-200)',
                }}
                className="rw-stack-sm"
              >
                <div className="rw-flex" style={{ gap: '0.5rem', alignItems: 'center' }}>
                  <Badge variant="info">STEP {step.step}</Badge>
                  <strong style={{ fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
                    {step.title}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </section>

      {/* 3. STEP 1 & STEP 2: Controlled Input Form */}
      <InputForm
        rawInputs={rawInputs}
        flags={flags}
        inputErrors={inputErrors}
        onUpdateInput={updateRawInput}
        onUpdateFlag={updateFlag}
        onLoadExampleC01={loadExampleC01}
        onLoadExampleC03={loadExampleC03}
        onResetAll={resetAll}
      />

      {/* 4. STEP 3: Result View (Cards, Comparison Bars, Summary Table, 1-KRW Breakdown) */}
      <ResultView
        comparisonResult={comparisonResult}
        metric={metric}
        onSelectMetric={setMetric}
        expandedBreakdown={expandedBreakdown}
        onToggleBreakdown={toggleBreakdown}
      />

      {/* 5. Section: 자주 묻는 질문 (FAQ) 및 전자상거래법 안내 (T18) */}
      <section id="faq" className="rw-card">
        <CardHeader>
          <CardTitle>자주 묻는 질문 & 2026 전자상거래법 가이드라인 (FAQ)</CardTitle>
          <CardDescription>
            반품 분쟁 예방과 손실 최소화를 위해 판매자가 반드시 숙지해야 하는 핵심 문답 9선입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="rw-stack">
          {FAQS.map((faq, idx) => (
            <div
              key={faq.id}
              style={{
                borderBottom: idx < FAQS.length - 1 ? '1px solid var(--color-slate-200)' : 'none',
                paddingBottom: '1rem',
                paddingTop: idx > 0 ? '0.5rem' : 0,
              }}
              className="rw-stack-xs"
            >
              <div className="rw-flex" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge
                  variant={
                    faq.category === 'LEGAL'
                      ? 'warning'
                      : faq.category === 'CALCULATION'
                      ? 'info'
                      : faq.category === 'PRIVACY'
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {faq.category === 'LEGAL'
                    ? '법률 준수'
                    : faq.category === 'CALCULATION'
                    ? '비용 산식'
                    : faq.category === 'PRIVACY'
                    ? '보안·프라이버시'
                    : '운영 실무'}
                </Badge>
                {faq.legalSource && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                    출처: {faq.legalSource}
                  </span>
                )}
              </div>

              <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
                {faq.question}
              </strong>

              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', margin: 0, lineHeight: 1.5 }}>
                {faq.answer}
              </p>
            </div>
          ))}
        </CardContent>
      </section>

      {/* 6. Section: 법률 면책 고지 및 운영자 정보 (T18) */}
      <section id="operator" className="rw-card" style={{ background: 'var(--color-slate-50)' }}>
        <CardHeader>
          <div className="rw-flex-between">
            <CardTitle>⚖️ 법률 비자문 면책 고지 및 운영자 정보</CardTitle>
            <Badge variant="warning">{OPERATOR_DISCLOSURE.status}</Badge>
          </div>
          <CardDescription>
            투명한 운영과 이용자 권리 보호를 위한 서비스 한계 및 운영자 고지 사항입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="rw-stack-md">
          <div
            style={{
              background: '#FFFFFF',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-200)',
              fontSize: '0.75rem',
              color: 'var(--color-slate-600)',
              whiteSpace: 'pre-line',
              lineHeight: 1.6,
            }}
          >
            {LEGAL_DISCLAIMER_TEXT.trim()}
          </div>

          {/* 약관 및 개인정보 처리방침 초안 열람 */}
          <details style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', fontSize: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-slate-800)' }}>
              📄 개인정보 미수집 및 프라이버시 보호 정책 확인
            </summary>
            <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-line', color: 'var(--color-slate-600)', lineHeight: 1.6 }}>
              {PRIVACY_POLICY_SUMMARY.trim()}
            </div>
          </details>

          <details style={{ background: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', fontSize: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-slate-800)' }}>
              📋 ReturnWise 무료 서비스 이용약관 (초안) 확인
            </summary>
            <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-line', color: 'var(--color-slate-600)', lineHeight: 1.6 }}>
              {TERMS_OF_SERVICE_DRAFT.trim()}
            </div>
          </details>

          <div
            style={{
              background: '#FFFFFF',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-slate-200)',
            }}
            className="rw-stack-xs"
          >
            <div className="rw-flex" style={{ gap: '0.5rem', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-900)' }}>
                🏢 서비스 운영자 정보
              </strong>
              <Badge variant="warning">사람 승인 대기</Badge>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', margin: 0 }}>
              {OPERATOR_DISCLOSURE.approvalRequiredNote}
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-slate-700)', marginTop: '0.5rem' }}>
              <div>• <strong>운영 주체</strong>: {OPERATOR_DISCLOSURE.companyName}</div>
              <div>• <strong>대표자</strong>: {OPERATOR_DISCLOSURE.representative}</div>
              <div>• <strong>사업자등록번호</strong>: {OPERATOR_DISCLOSURE.businessNumber}</div>
              <div>• <strong>통신판매업신고</strong>: {OPERATOR_DISCLOSURE.mailOrderReportNumber}</div>
              <div>• <strong>임시 문의처</strong>: {OPERATOR_DISCLOSURE.contactEmail}</div>
            </div>
          </div>
        </CardContent>
      </section>

      {/* 7. Footer */}
      <footer style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-slate-500)', paddingTop: '2rem', borderTop: '1px solid var(--color-slate-200)' }} className="rw-stack-sm">
        <p style={{ margin: 0 }}>
          © 2026 ReturnWise. 본 계산기는 한국 개정 전자상거래법(2026.7.21 시행) 및 판매자 표준 약관에 기초한 재무 시뮬레이션 도구입니다.
        </p>
        <p style={{ margin: 0 }}>
          개인정보 및 주문 식별값 수집 제로 (No PII) · 100% 브라우저 로컬 순수 연산
        </p>
        <div className="rw-flex" style={{ justifyContent: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <a href="#operator" style={{ color: 'var(--color-slate-600)' }}>이용약관 초안</a>
          <a href="#operator" style={{ color: 'var(--color-slate-600)' }}>개인정보 처리방침</a>
          <a href="#operator" style={{ color: 'var(--color-slate-600)' }}>법률 면책 고지</a>
          <a href="#operator" style={{ color: 'var(--color-slate-600)' }}>운영자 정보 (사람 승인 대기)</a>
        </div>
      </footer>
    </div>
  );
};

export default CalculatorPage;
