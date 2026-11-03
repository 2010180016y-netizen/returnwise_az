/**
 * ReturnWise Detailed Calculation Breakdown Component (src/features/calculator/Breakdown.tsx)
 * Renders unfolded math formulas, line-item ledger, assumptions, limitations, and copy-to-clipboard.
 * STRICT SAFETY RULE: NEVER describe recovered value as revenue/sales (매출) or profit (순이익).
 */

import React, { useState } from 'react';
import { CardHeader, CardTitle, CardContent, Button, ResultTable, Badge } from '../../components';
import { RankedAlternative } from '../../domain/types';
import { generateCopyableFormulaText, LEGAL_SOURCES } from '../../content/glossary';

export interface BreakdownProps {
  alternative: RankedAlternative;
  onClose: () => void;
  className?: string;
}

export const Breakdown: React.FC<BreakdownProps> = ({
  alternative,
  onClose,
  className = '',
}) => {
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      const text = generateCopyableFormulaText(alternative);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for environments without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error('Failed to copy formula text:', err);
    }
  };

  // Cash outflow formula text breakdown
  const cashFormulaParts = alternative.lineItems
    .filter((item) => item.type === 'CASH_OUTFLOW' || item.type === 'CREDIT')
    .map((item) => `${item.type === 'CREDIT' ? '-' : '+'}${item.name}(${item.amount.toLocaleString('ko-KR')}원)`)
    .join(' ');

  // Economic cost formula text breakdown
  const assetItem = alternative.lineItems.find((item) => item.type === 'ASSET_VALUE');
  const assetAmount = assetItem ? assetItem.amount : 0;

  return (
    <section
      id="step-breakdown"
      className={`rw-card ${className}`.trim()}
      style={{ border: '2px solid var(--color-primary-600)', background: '#ffffff' }}
      aria-label={`${alternative.name} 상세 산식 분해`}
    >
      <CardHeader>
        <div className="rw-flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="rw-flex" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Badge variant="info">상세 산식 분해</Badge>
              <CardTitle style={{ fontSize: '1.1875rem' }}>
                1원 단위 산식 분해: {alternative.name}
              </CardTitle>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-500)', margin: 0 }}>
              1원 단위 원장 항목과 대수적 수식을 투명하게 검증하고 사내 공유용으로 복사할 수 있습니다.
            </p>
          </div>

          <div className="rw-flex" style={{ gap: '0.5rem' }}>
            <Button
              type="button"
              variant={copySuccess ? 'primary' : 'outline'}
              size="sm"
              onClick={handleCopy}
              style={{ fontSize: '0.8125rem' }}
            >
              {copySuccess ? '복사 완료! ✓' : '📋 산식 텍스트 복사'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="상세 산식 닫기">
              닫기 ✕
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="rw-stack">
        {/* 1. Unfolded Formulas Box */}
        <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
          <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-900)', display: 'block', marginBottom: '0.5rem' }}>
            📐 대수 수식 분해 (Unfolded Formulas)
          </strong>

          {/* Cash Outflow Formula */}
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', display: 'block', fontWeight: 600 }}>
              [추가 현금 지출 공식]
            </span>
            <code style={{ display: 'block', padding: '0.375rem 0.5rem', background: '#ffffff', borderRadius: 4, border: '1px solid var(--color-slate-200)', fontSize: '0.8125rem', color: 'var(--color-slate-800)', fontFamily: 'monospace' }}>
              현금 지출 = {cashFormulaParts || '0원'} ={' '}
              <strong style={{ color: 'var(--color-slate-900)' }}>
                {alternative.cashOutflow.toLocaleString('ko-KR')}원
              </strong>
            </code>
          </div>

          {/* Economic Cost Formula */}
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', display: 'block', fontWeight: 600 }}>
              [순경제적 비용(실질 손실) 공식]
            </span>
            <code style={{ display: 'block', padding: '0.375rem 0.5rem', background: '#ffffff', borderRadius: 4, border: '1px solid var(--color-slate-200)', fontSize: '0.8125rem', color: 'var(--color-slate-800)', fontFamily: 'monospace' }}>
              순경제비용 = 현금지출({alternative.cashOutflow.toLocaleString('ko-KR')}원) - 회수순가치({assetAmount.toLocaleString('ko-KR')}원) ={' '}
              <strong style={{ color: 'var(--color-primary-700)' }}>
                {alternative.economicCost.toLocaleString('ko-KR')}원
              </strong>
            </code>
          </div>
        </div>

        {/* 2. 1-KRW Detailed Line Items Table */}
        <div>
          <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-900)', display: 'block', marginBottom: '0.5rem' }}>
            📋 세부 원장 항목표 (1원 단위 무결성 검증)
          </strong>
          <ResultTable
            rows={alternative.lineItems}
            totalCashOutflow={alternative.cashOutflow}
            totalEconomicCost={alternative.economicCost}
            showEconomicColumn={true}
          />
        </div>

        {/* 3. Assumptions & Limitations Notice Grid */}
        <div className="rw-grid-2" style={{ gap: '1rem', marginTop: '0.5rem' }}>
          {/* Left: Financial Boundaries */}
          <div style={{ background: 'var(--color-slate-50)', padding: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)' }}>
            <strong style={{ fontSize: '0.8125rem', color: 'var(--color-slate-900)', display: 'block', marginBottom: '0.375rem' }}>
              ⚖️ 회계 및 비용 산정 한계 고지
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.75rem', color: 'var(--color-slate-600)', lineHeight: 1.5 }}>
              <li>
                <strong>회수 순가치 평가 기준:</strong> 회수 상품 가치는 보수적 재고 자산 평가액이며, <em>매출이나 순이익으로 인식할 수 없습니다.</em>
              </li>
              <li>
                <strong>플랫폼 수수료 환급:</strong> 마켓별 정산 주기 및 취소 수수료 정책에 따라 실제 입금 시점이 다를 수 있습니다.
              </li>
              <li>
                <strong>공통 매몰원가 제외:</strong> 과거 사입원가는 모든 대안에 동일하게 기발생한 매몰비용이므로 추가비용 계산에서 제외됩니다.
              </li>
            </ul>
          </div>

          {/* Right: Legal Guardrails */}
          <div style={{ background: 'var(--color-primary-50)', padding: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary-100)' }}>
            <strong style={{ fontSize: '0.8125rem', color: 'var(--color-primary-900)', display: 'block', marginBottom: '0.375rem' }}>
              📜 2026 전자상거래법 출처 및 규정 확인
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.125rem', fontSize: '0.75rem', color: 'var(--color-primary-800)', lineHeight: 1.5 }}>
              {LEGAL_SOURCES.map((law) => (
                <li key={law.id} style={{ marginBottom: '0.25rem' }}>
                  <strong>{law.article}:</strong> {law.title} (
                  <a
                    href={law.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ color: 'var(--color-primary-700)', textDecoration: 'underline' }}
                  >
                    법령 확인
                  </a>
                  )
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Applied Specific Assumptions */}
        {alternative.assumptions.length > 0 && (
          <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-slate-300)' }}>
            <strong style={{ fontSize: '0.75rem', color: 'var(--color-slate-700)', display: 'block', marginBottom: '0.25rem' }}>
              📌 적용된 주요 가정:
            </strong>
            {alternative.assumptions.map((asm, idx) => (
              <p key={idx} style={{ fontSize: '0.75rem', color: 'var(--color-slate-600)', margin: '0.125rem 0' }}>
                • {asm}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </section>
  );
};

export default Breakdown;
