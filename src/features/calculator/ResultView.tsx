/**
 * ReturnWise Result View (src/features/calculator/ResultView.tsx)
 * Renders alternative cards, cost bars, dual-column summary table, and 1-KRW breakdown.
 * Strictly adheres to safety copy: NO '수익/확정절감' misleading phrasing.
 */

import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  Button,
} from '../../components';
import { Breakdown } from './Breakdown';
import {
  ComparisonResult,
  RankMetric,
  AlternativeCode,
  RankedAlternative,
} from '../../domain/types';

export interface ResultViewProps {
  comparisonResult: ComparisonResult;
  metric: RankMetric;
  onSelectMetric: (metric: RankMetric) => void;
  expandedBreakdown: AlternativeCode | null;
  onToggleBreakdown: (alt: AlternativeCode) => void;
}

export const ResultView: React.FC<ResultViewProps> = ({
  comparisonResult,
  metric,
  onSelectMetric,
  expandedBreakdown,
  onToggleBreakdown,
}) => {
  const { rankedList, comparisonNotice, bestAlternative } = comparisonResult;

  // Max value among compared metrics for visual bar scaling
  const maxMetricVal = Math.max(
    ...rankedList.map((a) => Math.max(0, a.comparedMetricValue)),
    1
  );

  return (
    <section id="step-results" className="rw-stack">
      {/* 1. Header & Metric Selector Tabs */}
      <div className="rw-flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="rw-flex" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="info">STEP 3</Badge>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
              대안 비교 결과 (Comparison Results)
            </h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-slate-500)' }}>
            적법성과 마켓 약관이 확인된 적격 대안들만 비교 순위에 포함됩니다.
          </p>
        </div>

        {/* Metric Selector Tabs */}
        <div
          role="tablist"
          aria-label="비교 기준 지표 선택"
          className="rw-flex"
          style={{ background: 'var(--color-slate-200)', padding: 3, borderRadius: 'var(--radius-md)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'ECONOMIC_COST'}
            className={`rw-btn ${metric === 'ECONOMIC_COST' ? 'rw-btn-primary' : 'rw-btn-ghost'}`}
            style={{ minHeight: 36, padding: '0 0.75rem', fontSize: '0.8125rem' }}
            onClick={() => onSelectMetric('ECONOMIC_COST')}
          >
            순경제비용 기준 (추천)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={metric === 'CASH_OUTFLOW'}
            className={`rw-btn ${metric === 'CASH_OUTFLOW' ? 'rw-btn-primary' : 'rw-btn-ghost'}`}
            style={{ minHeight: 36, padding: '0 0.75rem', fontSize: '0.8125rem' }}
            onClick={() => onSelectMetric('CASH_OUTFLOW')}
          >
            현금 지출 기준
          </button>
        </div>
      </div>

      {/* 2. Comparison Notice Banner */}
      <div style={{ background: 'var(--color-primary-50)', border: '1px solid var(--color-primary-100)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-primary-800)', fontWeight: 600 }}>
          💡 {comparisonNotice}
        </span>
      </div>

      {/* 3. Visual Cost Comparison Bars (수치 기반 막대 차트) */}
      <div className="rw-card" style={{ padding: '1rem' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
            📊 대안별 상대 비용 비교 막대 ({metric === 'ECONOMIC_COST' ? '순경제비용' : '현금 추가지출'})
          </strong>
        </div>
        <div className="rw-stack-sm">
          {rankedList.map((alt) => {
            const isEligible = alt.rankingEligible && alt.status === 'ELIGIBLE';
            const pct = Math.max(8, Math.min(100, Math.round((Math.max(0, alt.comparedMetricValue) / maxMetricVal) * 100)));
            const barBg = alt.isRecommended
              ? 'var(--color-success-600)'
              : isEligible
              ? 'var(--color-primary-600)'
              : 'var(--color-slate-400)';

            return (
              <div key={alt.alternative} style={{ marginBottom: '0.5rem' }}>
                <div className="rw-flex-between" style={{ fontSize: '0.8125rem', marginBottom: 2 }}>
                  <span style={{ fontWeight: alt.isRecommended ? 700 : 500, color: 'var(--color-slate-800)' }}>
                    {alt.name} {alt.isRecommended && '★ 최저비용 추천'}
                  </span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-slate-900)' }}>
                    {alt.comparedMetricValue.toLocaleString('ko-KR')}원
                  </span>
                </div>
                <div style={{ width: '100%', height: 12, background: 'var(--color-slate-100)', borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barBg,
                      borderRadius: 6,
                      transition: 'width 0.3s ease',
                    }}
                    role="progressbar"
                    aria-valuenow={alt.comparedMetricValue}
                    aria-valuemin={0}
                    aria-valuemax={maxMetricVal}
                    aria-label={`${alt.name} 비용 막대`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. 4 Cards Grid */}
      <div className="rw-grid-4">
        {rankedList.map((alt: RankedAlternative) => {
          const isRank1 = alt.rank === 1 && alt.isRecommended;
          const isBlocked = !alt.rankingEligible || alt.status !== 'ELIGIBLE';
          const isReview = alt.status === 'REQUIRES_REVIEW';
          const isNegativeEconomic = alt.economicCost < 0;

          return (
            <Card key={alt.alternative} isRecommended={isRank1} isDisabled={isBlocked}>
              <CardHeader>
                <div className="rw-flex-between" style={{ marginBottom: '0.25rem' }}>
                  {isRank1 ? (
                    <Badge variant="success">최저비용 추천 (1위)</Badge>
                  ) : alt.rank ? (
                    <Badge variant="neutral">{alt.rank}위</Badge>
                  ) : (
                    <Badge variant={isReview ? 'warning' : 'danger'}>
                      {isReview ? '확인 필요' : '추천 제외'}
                    </Badge>
                  )}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-400)' }}>
                    {alt.category === 'REFUND_GROUP' ? '환불 방식' : '교환 방식'}
                  </span>
                </div>
                <CardTitle style={{ fontSize: '1.0625rem' }}>{alt.name}</CardTitle>
              </CardHeader>

              <CardContent className="rw-stack-sm">
                {/* Primary Compared Metric */}
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', display: 'block' }}>
                    {metric === 'ECONOMIC_COST' ? '순경제비용' : '현금 추가지출'}
                  </span>
                  <strong
                    style={{
                      fontSize: '1.375rem',
                      color: isBlocked ? 'var(--color-slate-500)' : 'var(--color-slate-900)',
                    }}
                    className="tabular-nums"
                  >
                    {alt.comparedMetricValue.toLocaleString('ko-KR')}원
                  </strong>

                  {/* Negative Economic Cost Interpretation */}
                  {isNegativeEconomic && (
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-info-700)', marginTop: 2 }}>
                      ℹ️ 회수 자산 가치가 지출을 초과하여 회수 이득 발생
                    </span>
                  )}

                  {/* Delta vs Best */}
                  {alt.deltaVsBest !== null && alt.deltaVsBest > 0 && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-danger-600)', fontWeight: 600 }}>
                      +1위 대비 {alt.deltaVsBest.toLocaleString('ko-KR')}원 추가 지출
                    </span>
                  )}

                  {/* Savings if Chosen vs Baseline (표준 회수환불 대비 절감액) */}
                  {alt.savingsIfChosen !== null && alt.savingsIfChosen > 0 && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-success-700)', fontWeight: 600 }}>
                      ✓ 기준안 대비 {alt.savingsIfChosen.toLocaleString('ko-KR')}원 손실 절감 가능
                    </span>
                  )}
                </div>

                {/* Secondary Metric */}
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', borderTop: '1px solid var(--color-slate-100)', paddingTop: '0.5rem' }}>
                  <span style={{ display: 'block' }}>
                    {metric === 'ECONOMIC_COST'
                      ? `현금 지출: ${alt.cashOutflow.toLocaleString('ko-KR')}원`
                      : `순경제비용: ${alt.economicCost.toLocaleString('ko-KR')}원`}
                  </span>
                </div>

                {/* Reasons if Blocked or Requires Review */}
                {alt.reasons.length > 0 && (
                  <div style={{ background: '#ffffff', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-slate-300)' }}>
                    <span style={{ display: 'block', fontSize: '0.6875rem', color: isReview ? 'var(--color-warning-700)' : 'var(--color-danger-700)', fontWeight: 600, marginBottom: 2 }}>
                      {isReview ? '확인 필요 사유:' : '추천 제외 사유:'}
                    </span>
                    {alt.reasons.map((r: string, i: number) => (
                      <p key={i} style={{ fontSize: '0.6875rem', color: 'var(--color-slate-600)', margin: 0 }}>
                        • {r}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  onClick={() => onToggleBreakdown(alt.alternative)}
                  style={{ fontSize: '0.75rem' }}
                  aria-expanded={expandedBreakdown === alt.alternative}
                >
                  {expandedBreakdown === alt.alternative ? '산식 접기 ▴' : '상세 산식 보기 ▾'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* 5. Dual-Column Comprehensive Comparison Summary Table (수치 기반 표) */}
      <div className="rw-card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
            📋 4대 처리 방식 지표 대조표 (현금 지출 vs 순경제비용 동시 비교)
          </strong>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-slate-500)', marginTop: 2 }}>
            최저비용 대안: {bestAlternative ? bestAlternative.name : '없음 (검토 필요)'}
          </span>
        </div>

        <table className="rw-table" style={{ width: '100%', minWidth: '480px' }}>
          <thead>
            <tr>
              <th scope="col" style={{ width: '30%' }}>대안 방식</th>
              <th scope="col" style={{ width: '15%' }}>분류</th>
              <th scope="col" className="rw-td-number" style={{ width: '20%' }}>
                현금 추가지출 (원)
              </th>
              <th scope="col" className="rw-td-number" style={{ width: '20%' }}>
                순경제적 비용 (원)
              </th>
              <th scope="col" style={{ width: '15%', textAlign: 'center' }}>상태 / 순위</th>
            </tr>
          </thead>
          <tbody>
            {rankedList.map((alt) => {
              const isBest = alt.rank === 1 && alt.isRecommended;

              return (
                <tr
                  key={alt.alternative}
                  style={{
                    backgroundColor: isBest ? 'var(--color-success-50)' : undefined,
                    fontWeight: isBest ? 600 : 400,
                  }}
                >
                  <td>
                    <strong>{alt.name}</strong>
                    {isBest && (
                      <span style={{ display: 'inline-block', marginLeft: 6, fontSize: '0.6875rem', color: 'var(--color-success-700)', fontWeight: 700 }}>
                        [최저비용]
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)' }}>
                      {alt.category === 'REFUND_GROUP' ? '환불군' : '교환군'}
                    </span>
                  </td>
                  <td className="rw-td-number tabular-nums">
                    {alt.cashOutflow.toLocaleString('ko-KR')}원
                  </td>
                  <td className="rw-td-number tabular-nums">
                    {alt.economicCost.toLocaleString('ko-KR')}원
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {isBest ? (
                      <Badge variant="success">1위 추천</Badge>
                    ) : alt.rank ? (
                      <Badge variant="neutral">{alt.rank}위</Badge>
                    ) : (
                      <Badge variant={alt.status === 'REQUIRES_REVIEW' ? 'warning' : 'danger'}>
                        {alt.status === 'REQUIRES_REVIEW' ? '확인 필요' : '제외'}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 6. Section: 상세 산식 분해 (Breakdown Component) */}
      {expandedBreakdown && (() => {
        const selected = rankedList.find((a) => a.alternative === expandedBreakdown);
        if (!selected) return null;

        return (
          <Breakdown
            alternative={selected}
            onClose={() => onToggleBreakdown(expandedBreakdown)}
          />
        );
      })()}
    </section>
  );
};

export default ResultView;
