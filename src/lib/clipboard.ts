/**
 * ReturnWise Clipboard Management & Anonymous Report Generator (src/lib/clipboard.ts)
 * Generates PII-free anonymous decision reports and copies with multi-tier fallback.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. Absolutely NO customer PII (order ID, buyer name, phone, address) in clipboard text.
 * 2. Multi-tier fallback for restricted/insecure browser contexts.
 */

import { ComparisonResult, DecisionFlags, ScenarioInput, AlternativeCode } from '../domain/types';
import { formatMoneyKRW } from '../domain/money';

export interface ReportData {
  inputs: ScenarioInput;
  flags: DecisionFlags;
  comparison: ComparisonResult;
}

/**
 * Generates an anonymous, professional summary report for team sharing (Slack, Teams, Notion).
 * STRICT: Contains NO customer PII. Contains only business context, costs, and legal checks.
 */
export function generateAnonymousSummaryReport(data: ReportData): string {
  const { inputs, flags, comparison } = data;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

  const best = comparison.bestAlternative;
  const bestName = best ? getAlternativeLabel(best.alternative) : '추천 대안 없음 (추가 확인 필요)';

  const lines: string[] = [
    '========================================',
    '📊 [ReturnWise] 반품·교환 의사결정 요약 리포트',
    '========================================',
    `* 생성일시: ${now} (KST)`,
    `* 판매마켓: ${getPlatformLabel(flags.platform)}`,
    `* 귀책사유: ${getReasonLabel(flags.reason)}`,
    `* 고객요청: ${flags.buyerRequest === 'REFUND' ? '환불' : flags.buyerRequest === 'EXCHANGE' ? '교환' : '미확인'}`,
    `* 환급 대상금액: ${inputs.refundAmount !== undefined ? formatMoneyKRW(inputs.refundAmount) : '미입력'}`,
    `* 회수 상품가치: ${inputs.recoveredItemNetValue !== undefined ? formatMoneyKRW(inputs.recoveredItemNetValue) : '0원'}`,
    '',
    '----------------------------------------',
    '🎯 의사결정 요약 및 최저비용 추천',
    '----------------------------------------',
    `* 추천 대안: ${bestName}`,
  ];

  if (best) {
    lines.push(
      `* 순경제적 손실(기대비용): ${formatMoneyKRW(best.economicCost)} (회수가치 반영)`,
      `* 추가 현금 지출액: ${formatMoneyKRW(best.cashOutflow)} (실제 유출액)`
    );
  } else {
    lines.push('* 법률 요건 또는 판매자 귀책 미확인으로 안전 모드가 작동 중입니다.');
  }

  lines.push('', '----------------------------------------', '📋 4대 처리방식 비용 대조 (경제비용 / 현금지출)', '----------------------------------------');

  for (const alt of comparison.rankedList) {
    const isBest = alt.isRecommended ? ' [최저비용 1위]' : '';
    const isExcluded = alt.rank === null ? ' [추천 제외]' : '';
    const name = getAlternativeLabel(alt.alternative);
    const econ = formatMoneyKRW(alt.economicCost);
    const cash = formatMoneyKRW(alt.cashOutflow);
    const diff = alt.deltaVsBest !== null && alt.deltaVsBest > 0 ? ` (+${formatMoneyKRW(alt.deltaVsBest)} 손실)` : '';

    lines.push(`- ${name}${isBest}${isExcluded}: 순경제 ${econ} / 현금 ${cash}${diff}`);
    if (alt.rank === null && alt.reasons.length > 0) {
      lines.push(`  └ 제외 사유: ${alt.reasons[0]}`);
    }
  }

  lines.push('', '----------------------------------------', '⚖️ 법률 및 운영 주의사항', '----------------------------------------');
  if (flags.reason === 'SELLER_FAULT' || flags.reason === 'DEFECT_OR_DIFF') {
    lines.push('* 2026 전자상거래법 제18조 제9항: 판매자 귀책 시 반품비용 고객 전가 절대 금지.');
  }
  if (!flags.voluntaryAgreementConfirmed) {
    lines.push('* 부분환불(대안 3)은 소비자의 자발적 합의 및 마켓 시스템 허용 시에만 집행 가능.');
  }
  if (flags.isSpecialItem) {
    lines.push('* 특례 품목(식품/위생/주문제작 등): 전액환불 회수포기 또는 감정 절차 검토 필요.');
  }
  lines.push('* 본 리포트는 의사결정 참고용이며, 최종 정산은 입점 플랫폼 판매자센터 기준을 따릅니다.');
  lines.push('========================================');

  return lines.join('\n');
}

export type CopyResult =
  | { success: true; method: 'clipboard-api' | 'legacy-execCommand' }
  | { success: false; method: 'fallback-modal'; error: string };

/**
 * Copies plain text to clipboard with multi-tier fallback:
 * 1. Modern Navigator Clipboard API
 * 2. Document.execCommand('copy') with hidden textarea
 * 3. Graceful failure returning fallback-modal indicator
 */
export async function copyTextToClipboard(text: string): Promise<CopyResult> {
  // 1. Try Navigator Clipboard API if available and secure
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard-api' };
    } catch {
      // Permission denied or insecure context, fall through to legacy
    }
  }

  // 2. Legacy fallback using temporary textarea
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      // Prevent scrolling to bottom
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.setAttribute('readonly', '');

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (successful) {
        return { success: true, method: 'legacy-execCommand' };
      }
    } catch {
      // execCommand failed
    }
  }

  // 3. Fallback: prompt modal or manual copy
  return {
    success: false,
    method: 'fallback-modal',
    error: '브라우저 보안 설정으로 인해 클립보드에 자동 복사하지 못했습니다.',
  };
}

function getAlternativeLabel(code: AlternativeCode): string {
  switch (code) {
    case 'RETURN_FULL':
      return '대안 1: 표준 회수 후 전액환급';
    case 'KEEP_FULL':
      return '대안 2: 회수 없는 전액환급 (회수포기)';
    case 'KEEP_PARTIAL':
      return '대안 3: 합의 부분환급 (소비자 상품보유)';
    case 'EXCHANGE':
      return '대안 4: 1:1 맞교환 처리';
    default:
      return code;
  }
}

function getPlatformLabel(p: string): string {
  switch (p) {
    case 'NAVER':
      return '네이버 스마트스토어';
    case 'COUPANG':
      return '쿠팡';
    case 'INDEPENDENT':
      return '자사몰 (독립몰)';
    case 'OTHER':
      return '기타 오픈마켓';
    default:
      return p;
  }
}

function getReasonLabel(r: string): string {
  switch (r) {
    case 'BUYER_REMORSE':
      return '단순 변심 (구매자 귀책)';
    case 'SELLER_FAULT':
      return '오배송/파손 (판매자 귀책)';
    case 'DEFECT_OR_DIFF':
      return '표시광고 상이 (판매자 귀책)';
    case 'UNKNOWN_REASON':
      return '사유 불명/확인 중';
    default:
      return r;
  }
}
