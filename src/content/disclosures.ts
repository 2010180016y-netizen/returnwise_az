/**
 * ReturnWise Disclosures, Terms, Privacy & Operator Info (src/content/disclosures.ts)
 * Official disclaimers, usage instructions, terms draft, and operator placeholders.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. Operator business details MUST NOT be fabricated. Use REVIEW_REQUIRED without real info.
 * 2. Human approval required before publishing actual operator entities.
 */

export interface OperatorInfo {
  companyName: string;
  representative: string;
  businessNumber: string;
  mailOrderReportNumber: string;
  address: string;
  contactEmail: string;
  status: 'APPROVED' | 'REVIEW_REQUIRED';
  approvalRequiredNote: string;
}

export const OPERATOR_DISCLOSURE: OperatorInfo = {
  companyName: '[사람 승인 대기] ReturnWise 프로젝트 운영팀',
  representative: '[사람 승인 대기] 미지정',
  businessNumber: '[사람 승인 대기] 사업자등록번호 입력 필요',
  mailOrderReportNumber: '[사람 승인 대기] 통신판매업신고번호 입력 필요',
  address: '[사람 승인 대기] 사업장 소재지 입력 필요',
  contactEmail: 'contact-review@returnwise.local (임시 문의 창구)',
  status: 'REVIEW_REQUIRED',
  approvalRequiredNote:
    '특별 안전조건 준수: 실제 법인/개인사업자 등록 정보가 확정되어 사람 운영자의 서면 승인이 완료되기 전까지 임의의 사업자 정보를 게시하지 않습니다.',
};

export const HOW_TO_USE_STEPS = [
  {
    step: 1,
    title: '상황 및 법률 권리 확인 (STEP 1)',
    description:
      '고객의 반품 사유(단순변심, 오배송, 하자 등), 고객 요청(환불 또는 교환), 그리고 부분환불 자발적 합의 여부 등 필수 법률 게이트를 체크합니다.',
  },
  {
    step: 2,
    title: '비용 및 원가 파라미터 입력 (STEP 2)',
    description:
      '환급 예정 금액, 판매자 부담 배송비, 기본 검수/재포장비, 회수 상품 순가치 등을 1원 단위 정수로 입력합니다. 0원은 명시적으로 0을 입력합니다.',
  },
  {
    step: 3,
    title: '대안별 듀얼 지표 비교 (STEP 3)',
    description:
      '허용된 4대 대안 중 최저비용 추천(1위)과 함께 [순경제비용]과 [추가 현금지출] 탭을 전환하며 회사 상황에 맞는 최적 방안을 비교합니다.',
  },
  {
    step: 4,
    title: '상세 산식 검증 및 팀 공유 (STEP 4)',
    description:
      '1원 단위 상세 원장 항목을 펼쳐보고 이상이 없으면, [익명 요약 리포트 복사] 버튼을 눌러 슬랙이나 업무 메신저에 PII 유출 없이 공유합니다.',
  },
];

export const LEGAL_DISCLAIMER_TEXT = `
[법률 및 세무 비자문 면책 고지]
1. 본 서비스(ReturnWise)가 제공하는 모든 비용 계산 결과, 법률 가드레일 판정, 대안 추천은 2026 개정 전자상거래법 및 표준 이커머스 약관을 바탕으로 설계된 '의사결정 참고용 시뮬레이션'입니다.
2. 본 서비스는 변호사법에 따른 법률 자문이나 세무사법에 따른 세무 자문을 제공하지 않으며, 이를 대체할 수 없습니다.
3. 개별 판매 마켓(네이버, 쿠팡 등)의 자체 분쟁조정 기준, 판매자 특약, 상품별 개별 약관 및 구체적 소송 분쟁에 대해서는 반드시 전문 법률 전문가 또는 해당 플랫폼 고객센터와 상의하십시오.
4. ReturnWise는 사용자가 입력한 데이터의 오류나 외부 플랫폼 정책 변경으로 인해 발생하는 직접적, 간접적 손해에 대해 법적 책임을 부담하지 않습니다.
`;

export const PRIVACY_POLICY_SUMMARY = `
[개인정보 미수집 및 프라이버시 보호 정책]
1. 개인 식별 정보(PII) 미수집 원칙:
   ReturnWise는 주문번호, 고객 성명, 전화번호, 주소 등 특정 개인을 식별할 수 있는 정보를 일체 입력받지 않으며 수집하지 않습니다.
2. 100% 브라우저 로컬 연산:
   모든 금융 수식 연산 및 법률 게이트 검증은 사용자의 브라우저 메모리(JavaScript 런타임)에서만 동작하며 외부 서버로 전송되지 않습니다.
3. 선택적 로컬 스토리지:
   판매자 기본 설정(배송비, 검수비 등 비민감 운영값)은 사용자가 명시적으로 동의 체크한 경우에만 브라우저의 localStorage에 보관(최대 90일)되며, 언제든 '저장값 삭제' 버튼으로 즉시 영구 파기할 수 있습니다.
4. 제3자 트래커 및 쿠키 미사용:
   불필요한 광고 추적기, 행동 분석 쿠키, 외부 API 전송 스크립트를 일체 탑재하지 않습니다.
`;

export const TERMS_OF_SERVICE_DRAFT = `
[ReturnWise 무료 서비스 이용약관 (초안)]
제1조 (목적) 본 약관은 ReturnWise(이하 '서비스')가 제공하는 반품·교환 비용 계산기 웹 애플리케이션의 이용 조건을 규정함을 목적으로 합니다.
제2조 (서비스의 성격) 본 서비스는 무료로 제공되는 오픈 유틸리티 도구로서, 소규모 온라인 판매자의 합리적 비용 산정을 지원합니다.
제3조 (이용자의 의무) 이용자는 관련 법령(전자상거래법 등) 및 입점 플랫폼의 운영 약관을 준수해야 하며, 본 서비스의 결과를 소비자 권리를 부당하게 침해하는 수단으로 악용해서는 안 됩니다.
제4조 (지적재산권) 서비스의 디자인, 계산 엔진 산식 구조 및 텍스트 콘텐츠의 저작권은 프로젝트 팀에 귀속됩니다.
제5조 (면책) 서비스의 지속적 제공이나 결과의 완전한 무오류성에 대해 보증하지 않으며, 서비스 이용과 관련하여 발생한 분쟁에 대해 책임을 지지 않습니다.
`;
