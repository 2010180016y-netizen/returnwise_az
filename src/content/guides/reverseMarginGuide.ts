/**
 * Guide 5: 초보 이커머스 셀러 반품 역마진 방지 5대 원칙 및 재고 순가치 회수 가이드
 */

import type { GuideContent } from './smartstoreReturnGuide';

export const reverseMarginGuide: GuideContent = {
  id: 'guide-05',
  slug: 'reverse-margin-prevention-checklist-guide',
  title: '초보 이커머스 셀러 반품 역마진 방지 5대 원칙 및 재고 순가치 회수 가이드',
  subtitle: '매출 1억에도 반품비로 적자 나는 셀러를 위한 현금 지출 vs 순경제비용 실무 점검표',
  targetKeyword: '온라인 쇼핑몰 반품 역마진 방지',
  summary:
    '온라인 쇼핑몰 운영에서 겉으로는 매출이 나지만 반품 1건당 왕복 택배비, 포장 부자재, 플랫폼 결제수수료, 재고 감가상각이 누적되어 역마진이 발생하는 구조적 원인을 파헤치고, 이를 방어하는 5대 핵심 실무 원칙을 제시합니다.',
  realisticScenario: {
    title: '월 매출 1,000만원, 마진율 20% 스토어의 반품률 8% 역마진 시뮬레이션',
    description:
      '객단가 25,000원, 월 400건 판매. 마진 20%(건당 5,000원)로 월 기대이익 200만원. 그러나 반품 32건(8%) 발생 시, 회수운임(6,000원*32=192,000원) + 포장폐기(1,000원*32=32,000원) + 상품 훼손 감가(10,000원*16=160,000원)로 총 384,000원의 직접 손실 발생하여 실질 마진이 19% 급감함.',
    itemPrice: 25000,
    initialShipping: 3000,
    returnShipping: 3000,
    commissionRate: 5.5,
  },
  exactFormulaMath: {
    description: '반품 건당 경제적 실질 손실 산정 모델 (PRD v0.1.0)',
    stepByStepFormula: [
      '1. 순경제적 손실 = 추가 현금 지출 - 회수 상품 순가치',
      '2. 추가 현금 지출 = 고객 환급액 + 왕복 회수운임 + 포장 부가비용 - 플랫폼 수수료 환급액',
      '3. 회수 상품 순가치 = 재판매 가능 판매가 - 재포장/세척 비용',
      '4. 역마진 경보 발령 조건: 순경제적 손실 > (정상 판매 기대 마진 * 3배)',
      '5. 대안별 최적화: 회수운임 > 회수 순가치인 경우 "회수포기(C02)"로 즉각 전환하여 운임 누출 차단',
    ],
    calculationResult: {
      cashOutflow: 32000,
      economicCost: 18500,
      explanation:
        '단순히 환급액만 볼 것이 아니라 회수운임과 재판매 가능 순가치를 정밀하게 비교하여 손실을 최소화하는 대안을 채택해야 합니다.',
    },
  },
  legalComplianceNotice: {
    statute: '2026 전자상거래법 제17조 및 부당특약 무효 규정',
    provisions: [
      '소비자의 청약철회 권리는 법률상 보장되므로 반품 자체를 원천 차단하는 것은 불법임.',
      '합법적인 비용 방어는 (1) 왕복배송비의 정확한 사전 고지, (2) 저단가 상품의 스마트한 회수포기, (3) 자발적 합의 부분환불을 통해서만 가능함.',
    ],
    cautions:
      '"세일 상품 반품 절대 불가", "단순변심 반품 시 위약금 2만원" 등의 문구는 공정위 과태료 부과 대상입니다.',
  },
  callToAction: {
    text: '우리 스토어의 반품 손실을 지금 1원 단위로 정밀 진단해 보세요.',
    targetPath: '/',
    buttonLabel: '반품 역마진 방어 계산기 열기',
  },
  qualityPass: true,
};
