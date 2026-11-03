/**
 * ReturnWise FAQ Content Module (src/content/faq.ts)
 * Comprehensive FAQ with minimum 8+ structured items covering calculation, legal compliance, and operations.
 * Includes review status and strict legal disclaimers.
 */

export interface FAQItem {
  id: string;
  category: 'CALCULATION' | 'LEGAL' | 'OPERATIONAL' | 'PRIVACY';
  question: string;
  answer: string;
  legalSource?: string;
  reviewStatus: 'APPROVED' | 'REVIEW_REQUIRED';
  approvedBy?: string;
}

export const FAQS: FAQItem[] = [
  {
    id: 'faq-01-metrics-difference',
    category: 'CALCULATION',
    question: "Q1. '순경제비용'과 '추가 현금지출'은 어떻게 다르고, 왜 둘 다 확인해야 하나요?",
    answer:
      "'추가 현금지출'은 반품 처리를 위해 당장 판매자의 계좌나 정산금에서 빠져나가는 순수 현금(환급금, 택배비 등)입니다. 반면 '순경제비용'은 현금 지출에서 되돌려받은 상품의 순가치(재판매 가능액)를 뺀 실제 경제적 손실입니다. 단기 현금 흐름 점검에는 '현금지출'이, 회사의 실제 장부상 손익 판단에는 '순경제비용'이 기준이 됩니다.",
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_FINANCE_REVIEWER',
  },
  {
    id: 'faq-02-seller-fault-shipping',
    category: 'LEGAL',
    question: 'Q2. 오배송이나 상품 하자 시, 고객에게 반품 배송비를 부담시킬 수 있나요?',
    answer:
      '절대 불가합니다. 2026년 7월 21일 시행 개정 전자상거래법 제18조 제9항에 따라 상품 하자, 오배송 등 판매자 귀책 사유인 경우 반품에 소요되는 모든 비용은 판매자가 전액 부담해야 하며, 이를 특약으로 고객에게 전가하는 행위는 동법 제35조(강행규정)에 의해 무효 처리되고 과태료 대상이 됩니다.',
    legalSource: '전자상거래법 제18조 제9항, 제35조',
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_COMPLIANCE_OFFICER',
  },
  {
    id: 'faq-03-partial-refund-conditions',
    category: 'LEGAL',
    question: 'Q3. 비용을 아끼기 위해 부분환불을 고객에게 마음대로 제안해도 되나요?',
    answer:
      '불가합니다. 부분환불(대안 3)은 반드시 3대 요건이 충족되어야 합니다: ① 소비자가 상품을 보유한 채 일정액만 돌려받는 데 자발적으로 사전 합의함, ② 판매 마켓 시스템상 부분환불 처리가 정책적으로 허용됨, ③ 소비자의 법정 전액 청약철회 권리를 부당하게 제한하거나 강요하지 않음. 합의 없는 일방적 부분환불 제안이나 처리는 전자상거래법 위반이 됩니다.',
    legalSource: '전자상거래법 제17조 제1항, 제35조',
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_COMPLIANCE_OFFICER',
  },
  {
    id: 'faq-04-exchange-suggestion-restriction',
    category: 'LEGAL',
    question: 'Q4. 고객이 환불을 원하는데 교환이 더 싸다고 교환을 제안하면 왜 안 되나요?',
    answer:
      '소비자가 법정 청약철회 기간 내에 정당하게 계약 해제(환불)를 요구한 경우, 판매자가 비용 절감을 위해 교환을 강요하거나 일방적으로 맞교환 처리하는 것은 청약철회권 방해 행위에 해당합니다. 고객이 먼저 교환을 원하거나 교환 제안에 명시적으로 사전 동의한 경우에만 교환 대안이 유효합니다.',
    legalSource: '전자상거래법 제17조 제1항 (청약철회권)',
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_COMPLIANCE_OFFICER',
  },
  {
    id: 'faq-05-recovered-item-valuation',
    category: 'CALCULATION',
    question: "Q5. 회수 상품 순가치는 왜 '매출'이나 '순이익'으로 잡으면 안 되나요?",
    answer:
      '회수된 반품 상품은 판매가 완료된 것이 아니라 재고 자산으로 환원된 상태입니다. 재포장비, 검수비, 감가상각, B급 재판매 할인율을 보수적으로 차감한 순회수가능가액(NRV)으로 평가해야 하며, 이를 매출이나 확정 이익으로 잡으면 회계상 손실이 왜곡되어 더 큰 손실을 초래할 수 있습니다.',
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_FINANCE_REVIEWER',
  },
  {
    id: 'faq-06-platform-fee-credit',
    category: 'OPERATIONAL',
    question: 'Q6. 오픈마켓 판매 수수료 환급은 언제 반영해야 하나요?',
    answer:
      '대다수 플랫폼(스마트스토어, 쿠팡 등)은 전액 환불 처리 완료 시 원 결제수수료 및 카테고리 중개 수수료를 판매자 정산금으로 환급해 줍니다. 단, 부분환불이나 귀책 사유에 따라 수수료 반환 비율이 달라질 수 있으므로, 입점 마켓 판매자센터의 실제 환급 확정 금액을 확인 후 입력해야 합니다.',
    reviewStatus: 'APPROVED',
    approvedBy: 'OPERATIONS_DIRECTOR',
  },
  {
    id: 'faq-07-special-items-guidance',
    category: 'OPERATIONAL',
    question: 'Q7. 신선식품, 맞춤제작, 위생용품 등 특례 품목은 어떻게 처리하나요?',
    answer:
      '시간 경과로 재판매가 불가능한 농축수산물, 개인 맞춤제작 상품, 개봉 시 위생상 재사용이 불가능한 상품 등은 전자상거래법 제17조 제2항에 따라 청약철회가 제한될 수 있습니다. 회수 운임만 낭비되고 전량 폐기해야 하는 경우가 많으므로 [대안 2: 회수 없는 전액환급]을 적극 검토하시고, 분쟁 시 마켓 고객센터 및 소비자분쟁해결기준을 확인해야 합니다.',
    legalSource: '전자상거래법 제17조 제2항, 소비자분쟁해결기준',
    reviewStatus: 'APPROVED',
    approvedBy: 'OPERATIONS_DIRECTOR',
  },
  {
    id: 'faq-08-privacy-and-storage',
    category: 'PRIVACY',
    question: 'Q8. 계산기에 입력한 주문 정보나 금액이 외부 서버나 제3자에게 저장되나요?',
    answer:
      '전혀 저장되지 않습니다. ReturnWise는 별도의 백엔드 데이터베이스나 로그인 서버가 없는 100% 순수 클라이언트 정적 웹앱입니다. 모든 연산은 사용자의 브라우저 메모리 내에서만 즉시 실행되며, 주문번호나 고객명 같은 개인정보(PII) 입력 필드 자체가 존재하지 않습니다. 판매자 기본 배송비 설정 또한 사용자가 직접 동의한 경우에만 로컬 브라우저 스토리지에 한시적으로 보관됩니다.',
    reviewStatus: 'APPROVED',
    approvedBy: 'PRIVACY_OFFICER',
  },
  {
    id: 'faq-09-legal-advice-disclaimer',
    category: 'LEGAL',
    question: 'Q9. ReturnWise의 계산 결과와 추천은 법적 효력이 있는 자문인가요?',
    answer:
      '아닙니다. 본 계산기는 2026 개정 전자상거래법 및 주요 이커머스 표준 정책을 바탕으로 판매자의 합리적 비용 비교를 돕는 의사결정 참고용 시뮬레이션 도구입니다. 개별 계약 조건, 마켓별 특약, 구체적 분쟁 상황에 대한 법적 판단이나 분쟁 해결은 전문 법률 전문가 또는 각 플랫폼 판매자센터의 안내를 받으시기 바랍니다.',
    reviewStatus: 'APPROVED',
    approvedBy: 'LEGAL_COMPLIANCE_OFFICER',
  },
];
