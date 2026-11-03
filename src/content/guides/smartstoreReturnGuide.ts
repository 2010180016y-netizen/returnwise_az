/**
 * Guide 1: 스마트스토어 단순변심 반품 배송비 계산 및 분쟁 예방 실무 가이드
 */

export interface GuideContent {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  targetKeyword: string;
  summary: string;
  realisticScenario: {
    title: string;
    description: string;
    itemPrice: number;
    initialShipping: number;
    returnShipping: number;
    commissionRate: number;
  };
  exactFormulaMath: {
    description: string;
    stepByStepFormula: string[];
    calculationResult: {
      cashOutflow: number;
      economicCost: number;
      explanation: string;
    };
  };
  legalComplianceNotice: {
    statute: string;
    provisions: string[];
    cautions: string;
  };
  callToAction: {
    text: string;
    targetPath: string;
    buttonLabel: string;
  };
  qualityPass: boolean;
}

export const smartstoreReturnGuide: GuideContent = {
  id: 'guide-01',
  slug: 'smartstore-return-shipping-guide',
  title: '스마트스토어 단순변심 반품 배송비 계산 및 분쟁 예방 가이드',
  subtitle: '초기 무료배송 시 왕복배송비 청구 기준과 네이버 결제수수료 환급 산식',
  targetKeyword: '스마트스토어 반품 배송비 계산',
  summary:
    '소비자가 단순변심으로 청약철회를 요구할 때, 초기 무료배송 건의 왕복 배송비(6,000원) 청구 적법성과 네이버 주문관리 수수료(5.5%) 환급을 반영한 실제 판매자 현금 유출 및 순경제비용을 1원 단위로 계산합니다.',
  realisticScenario: {
    title: '판매가 30,000원 의류 초기 무료배송 건의 단순변심 반품',
    description:
      '고객이 색상 단순변심으로 반품을 접수함. 판매자는 초기 배송비 3,000원을 부담(무료배송)하였으며, 계약 택배사 회수운임은 3,000원(판매자 계약가)임. 네이버 매출연동+결제 수수료는 5.5%(1,650원)이며 상품 재고 순가치는 9,000원임.',
    itemPrice: 30000,
    initialShipping: 3000,
    returnShipping: 3000,
    commissionRate: 5.5,
  },
  exactFormulaMath: {
    description: '전자상거래법 제18조 제9항에 따른 단순변심 반품비 계산',
    stepByStepFormula: [
      '1. 고객 환급액 = 결제원금(30,000원) - 왕복배송비 차감(6,000원) = 24,000원',
      '2. 택배사 지급 회수운임 = 3,000원',
      '3. 네이버 수수료 환급 = 전액 취소 시 수수료 1,650원 전액 취소/환급',
      '4. 추가 현금 지출 = 환급액(24,000원) + 회수운임(3,000원) - 수수료환급(1,650원) = 25,350원',
      '5. 순경제적 손실 = 추가 현금 지출(25,350원) - 회수 상품 순가치(9,000원) = 16,350원',
    ],
    calculationResult: {
      cashOutflow: 25350,
      economicCost: 16350,
      explanation:
        '고객에게 왕복 배송비 6,000원을 합법적으로 차감함으로써 판매자의 실제 순경제적 손실을 16,350원으로 방어합니다.',
    },
  },
  legalComplianceNotice: {
    statute: '2026 전자상거래법 제18조 제9항 (반환비용의 부담)',
    provisions: [
      '제18조 제9항: 청약철회등의 경우 공급받은 재화등의 반환에 필요한 비용은 소비자가 부담한다.',
      '초기 무료배송이었던 경우, 최초 발송 배송비는 소비자가 반환 비용과 함께 부담하는 것이 합법적임.',
    ],
    cautions:
      '단, 실제 소요된 택배비보다 과다한 위약금 성격의 반품비(예: 10,000원 이상 임의 청구)는 불공정 행위로 시정명령 대상이 될 수 있습니다.',
  },
  callToAction: {
    text: '내 스토어의 반품 건을 1초 만에 최적 대안으로 계산해 보세요.',
    targetPath: '/',
    buttonLabel: '지금 반품 비용 계산기 실행하기',
  },
  qualityPass: true,
};
