/**
 * ReturnWise Glossary & Calculation Formulas (src/content/glossary.ts)
 * Financial terms, legal references, and formula explanations.
 * STRICT SAFETY RULE: NEVER describe recovered item value as revenue/sales (매출) or profit (순이익).
 */

import { RankedAlternative } from '../domain/types';

export interface GlossaryItem {
  id: string;
  term: string;
  shortName: string;
  category: 'FINANCIAL' | 'LEGAL' | 'OPERATIONAL';
  definition: string;
  practicalExample: string;
  cautions: string;
}

export const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    id: 'cash-outflow',
    term: '추가 현금 지출 (Cash Outflow)',
    shortName: '현금 지출',
    category: 'FINANCIAL',
    definition:
      '반품 또는 교환 건을 처리하기 위해 판매자의 은행 계좌나 정산 유보금에서 실제로 빠져나가는 순수 현금 총액입니다. 고객 환급금, 택배사 회수 운송비, 물류 검품 수수료, 재출고 배송비 등이 포함됩니다.',
    practicalExample:
      '고객에게 30,000원을 환급하고 왕복 배송비 4,500원을 택배사에 지급하면 현금 지출은 34,500원입니다.',
    cautions:
      '단기 유동성(현금 흐름)을 점검할 때 핵심 기준이 됩니다. 회수 상품 가치는 현금이 아니므로 현금 지출 계산에서 차감할 수 없습니다.',
  },
  {
    id: 'economic-cost',
    term: '순경제적 비용 (Economic Cost)',
    shortName: '순경제비용',
    category: 'FINANCIAL',
    definition:
      '추가 현금 지출에서 회수된 상품의 보수적 잔존 자산 가치(재고 순가치)를 공제한 판매자의 실질적 경제 손실액입니다.',
    practicalExample:
      '현금 지출이 34,500원이지만 정상 회수되어 재판매 가능한 상품의 가치가 9,000원이라면, 순경제적 손실은 25,500원입니다.',
    cautions:
      '회수 상품의 가치는 비현금성 재고 자산 가치 평가액일 뿐이며, 당장 손에 쥐는 매출이나 순이익이 아닙니다.',
  },
  {
    id: 'recovered-item-net-value',
    term: '회수 상품 순가치 (Recovered Item Net Value)',
    shortName: '회수 순가치',
    category: 'FINANCIAL',
    definition:
      '반품 회수된 상품을 검품·재포장 후 정상 재판매하거나 리퍼비시/부품화할 때 판매자에게 보존되는 보수적 순자산 가치입니다.',
    practicalExample:
      '원가 10,000원 상품이 미개봉 상태로 회수되어 재포장비 1,000원을 제외하고 9,000원의 재고자산 가치로 입고되는 경우입니다.',
    cautions:
      '절대 판매 매출이나 순이익으로 인식해서는 안 되며, 파손/개봉 등으로 재판매가 불가능한 경우 0원으로 산정해야 합니다.',
  },
  {
    id: 'fee-reversal-credit',
    term: '플랫폼 수수료 환급 (Fee Reversal Credit)',
    shortName: '수수료 환급',
    category: 'FINANCIAL',
    definition:
      '주문 취소 및 환불 처리가 완료됨에 따라 네이버 스마트스토어, 쿠팡, 자사몰 PG사 등에서 판매자에게 반환하는 결제 및 판매 수수료 크레딧입니다.',
    practicalExample:
      '판매가 30,000원에 부과되었던 마켓 수수료 1,000원이 환불 확정 후 판매자 정산금으로 복구되는 경우입니다.',
    cautions:
      '마켓별 환불 정책과 정산 주기에 따라 환급 시점 및 취소 수수료 공제 여부가 상이하므로 마켓 정산서를 확인해야 합니다.',
  },
  {
    id: 'initial-procurement-cost',
    term: '기발생 상품 매입원가 (Initial Procurement Cost)',
    shortName: '공통 매몰원가',
    category: 'FINANCIAL',
    definition:
      '상품을 소싱하거나 제조할 때 이미 지출이 완료된 과거 매몰비용(Sunk Cost)입니다.',
    practicalExample:
      '반품을 회수하든 폐기하든 이미 과거에 공장에 지급한 사입가 10,000원은 변하지 않습니다.',
    cautions:
      '반품 의사결정에 따른 "추가 비용"을 산출할 때 기발생 사입가를 중복 가산하면 비용이 왜곡되므로 한계 의사결정 계산에서 제외합니다.',
  },
  {
    id: 'voluntary-agreement',
    term: '소비자 자발적 합의 (Voluntary Agreement)',
    shortName: '자발적 합의',
    category: 'LEGAL',
    definition:
      '전자상거래법 제17조에 따라 정당한 청약철회 기간 내 소비자가 법정 권리를 행사하기 전, 판매자와 대등한 입장에서 부분환불이나 대안 처리에 사전에 명시적으로 동의하는 것을 의미합니다.',
    practicalExample:
      '단순 변심 고객에게 미세 흠집 할인 명목으로 5,000원 부분환불을 제안하고 고객이 메신저나 유선으로 동의한 경우입니다.',
    cautions:
      '소비자의 자발적 동의 없이 일방적으로 부분환불을 집행하거나 전액 환불을 거부하는 것은 법률 위반(강행규정 위반)입니다.',
  },
];

export interface LegalSourceReference {
  id: string;
  lawName: string;
  article: string;
  title: string;
  coreRule: string;
  impactOnReturnWise: string;
  sourceUrl: string;
}

export const LEGAL_SOURCES: LegalSourceReference[] = [
  {
    id: 'law-article-17',
    lawName: '전자상거래 등에서의 소비자보호에 관한 법률',
    article: '제17조 (청약철회등)',
    title: '법정 청약철회권 보장',
    coreRule:
      '소비자는 재화 등을 공급받은 날부터 7일 이내에 청약철회를 할 수 있으며, 표시·광고 내용과 다르거나 계약 내용과 다르게 이행된 경우에는 공급받은 날부터 3개월 이내, 그 사실을 안 날 또는 알 수 있었던 날부터 30일 이내에 청약철회를 할 수 있다.',
    impactOnReturnWise:
      '정당한 청약철회 권리를 제한하는 일방적 부분환불 강요나 환불 거부를 원천 차단합니다 (L03, L05).',
    sourceUrl: 'https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률',
  },
  {
    id: 'law-article-18-9',
    lawName: '전자상거래 등에서의 소비자보호에 관한 법률',
    article: '제18조 제9항 (반품비용 부담)',
    title: '판매자 귀책 시 운임 부담 주체',
    coreRule:
      '재화등의 내용이 표시·광고의 내용과 다르거나 계약내용과 다르게 이행되어 청약철회등을 하는 경우 재화등의 반환에 필요한 비용은 통신판매업자가 부담한다.',
    impactOnReturnWise:
      '판매자 귀책(오배송/파손/표시상이)일 때 고객에게 반품 배송비를 전가하는 대안을 원천 차단합니다 (L02).',
    sourceUrl: 'https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률',
  },
  {
    id: 'law-article-35',
    lawName: '전자상거래 등에서의 소비자보호에 관한 법률',
    article: '제35조 (소비자피해보상보험계약등)',
    title: '강행규정성 (소비자 불리 약정 무효)',
    coreRule:
      '제17조부터 제19조까지의 규정을 위반한 약정으로서 소비자에게 불리한 것은 효력이 없다.',
    impactOnReturnWise:
      '마켓 상세페이지에 "환불 불가"를 기재했더라도 법정 효력이 없음을 안내하고 안전모드를 강제합니다.',
    sourceUrl: 'https://www.law.go.kr/법령/전자상거래등에서의소비자보호에관한법률',
  },
];

/**
 * 대안별 산식 텍스트 복사용 리포트 생성기
 * 클립보드에 바로 붙여넣어 사내 메신저나 메모에 공유할 수 있는 표준 텍스트를 생성합니다.
 */
export function generateCopyableFormulaText(alt: RankedAlternative): string {
  const isBest = alt.rank === 1 && alt.isRecommended;

  const lines: string[] = [
    `[ReturnWise 반품 비용 산식 리포트]`,
    `대안 방식: ${alt.name} (${alt.category === 'REFUND_GROUP' ? '환불' : '교환'})`,
    `적격 상태: ${alt.status === 'ELIGIBLE' ? '적격 (비교 가능)' : alt.status === 'REQUIRES_REVIEW' ? '확인 필요' : '추천 제외'}`,
    isBest ? `추천 순위: 1위 최저비용 추천` : alt.rank ? `추천 순위: ${alt.rank}위` : `추천 순위: 순위 제외`,
    ``,
    `1. 지표 요약`,
    `- 추가 현금 지출 (통장 유출액): ${alt.cashOutflow.toLocaleString('ko-KR')}원`,
    `- 순경제적 손실 (자산가치 반영): ${alt.economicCost.toLocaleString('ko-KR')}원`,
    alt.deltaVsBest ? `- 최저비용(1위) 대비 차액: +${alt.deltaVsBest.toLocaleString('ko-KR')}원 추가 지출` : '',
    alt.savingsIfChosen ? `- 기준안 대비 절감액: ${alt.savingsIfChosen.toLocaleString('ko-KR')}원 손실 절감 가능` : '',
    ``,
    `2. 원장 세부 항목 분해 (1원 단위)`,
  ].filter(Boolean);

  alt.lineItems.forEach((item) => {
    const sign = item.type === 'CASH_OUTFLOW' ? '+' : '-';
    lines.push(`  ${sign} ${item.name}: ${item.amount.toLocaleString('ko-KR')}원 (${item.description || item.type})`);
  });

  lines.push(``);
  lines.push(`3. 주요 계산 가정 및 유의사항`);
  alt.assumptions.forEach((asm) => {
    lines.push(`  • ${asm}`);
  });

  lines.push(`  • [중요] 회수 상품 가치는 보수적 재고 평가액이며, 매출이나 순이익이 아닙니다.`);
  lines.push(`  • [법률] 2026 전자상거래법에 따라 소비자 자발적 동의 없는 일방적 부분환불은 무효입니다.`);
  lines.push(``);
  lines.push(`- 생성 도구: ReturnWise (2026 전자상거래법 준수 반품 의사결정 계산기)`);

  return lines.join('\n');
}
