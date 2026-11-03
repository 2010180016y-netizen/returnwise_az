/**
 * ReturnWise Domain Types (src/domain/types.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 * SSOT: docs/02_FINANCIAL_DOMAIN.md, docs/CALCULATION_CONTRACT.md, docs/DECISION_GATE_MATRIX.md
 */

export type ReturnReason =
  | 'BUYER_REMORSE'
  | 'SELLER_FAULT'
  | 'DEFECT_OR_DIFF'
  | 'UNKNOWN_REASON';

export type BuyerRequest = 'REFUND' | 'EXCHANGE' | 'UNKNOWN';

export type PlatformType = 'NAVER' | 'COUPANG' | 'INDEPENDENT' | 'OTHER';

export type AlternativeCode =
  | 'RETURN_FULL'
  | 'KEEP_FULL'
  | 'KEEP_PARTIAL'
  | 'EXCHANGE';

export type AlternativeStatus =
  | 'ELIGIBLE'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_OR_REVIEW';

export type EligibilityStatus =
  | 'ELIGIBLE'
  | 'REQUIRES_REVIEW'
  | 'INELIGIBLE';

export type RankMetric = 'ECONOMIC_COST' | 'CASH_OUTFLOW';

export type AlternativeCategory = 'REFUND_GROUP' | 'EXCHANGE_GROUP';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReturnInputs {
  refundAmount?: number;
  reverseShippingSellerCost?: number;
  reverseShippingBuyerCost?: number;
  handlingCost?: number;
  recoveredItemNetValue?: number;
  feeReversalCredit?: number;
  additionalSellerCost?: number;
  agreedPartialRefund?: number;
  replacementCost?: number;
  replacementOutboundShipping?: number;
}

export interface ScenarioInput extends ReturnInputs {
  /** 기발생 매몰원가 (계산 시 중복 합산 배제 검증용) */
  initialProcurementCost?: number;
}

export interface DecisionFlags {
  reason: ReturnReason;
  buyerRequest: BuyerRequest;
  platform: PlatformType;
  policyReviewed: boolean;
  rightsReviewed: boolean;
  voluntaryAgreementConfirmed?: boolean;
  permittedByPolicyConfirmed?: boolean;
  rightsNotRestrictedConfirmed?: boolean;
  buyerAgreedExchange?: boolean;
  /** 식품, 위생용품, 맞춤제작 등 청약철회 특례 품목 여부 (L07) */
  isSpecialItem?: boolean;
  /** 마켓 정책 변경/재검증 주기 도래 안전모드 여부 (L08) */
  isPolicyOutdated?: boolean;
}

export type LineItemType = 'CASH_OUTFLOW' | 'CREDIT' | 'ASSET_VALUE';

export interface CostLineItem {
  id: string;
  name: string;
  amount: number;
  type: LineItemType;
  description?: string;
}

export interface AlternativeCostBreakdown {
  alternative: AlternativeCode;
  name: string;
  cashOutflow: number;
  economicCost: number;
  lineItems: CostLineItem[];
}

export interface ScenarioResult {
  inputs: ScenarioInput;
  results: Record<AlternativeCode, AlternativeCostBreakdown>;
  sortedAlternatives: AlternativeCostBreakdown[];
}

export interface OptionEligibility {
  alternative: AlternativeCode;
  name: string;
  status: EligibilityStatus;
  rankingEligible: boolean;
  reasons: string[];
  legalNotice?: string;
}

export interface PolicyEvaluationResult {
  flags: DecisionFlags;
  evaluations: Record<AlternativeCode, OptionEligibility>;
  eligibleAlternatives: AlternativeCode[];
  hasSpecialItemWarning: boolean;
  isSafeModeActive: boolean;
  globalWarnings: string[];
}

export interface RankedAlternative {
  alternative: AlternativeCode;
  name: string;
  category: AlternativeCategory;
  status: EligibilityStatus;
  rankingEligible: boolean;
  rank: number | null;
  isRecommended: boolean;
  isTie: boolean;
  cashOutflow: number;
  economicCost: number;
  comparedMetricValue: number;
  deltaVsBest: number | null;
  savingsIfChosen: number | null;
  lineItems: CostLineItem[];
  assumptions: string[];
  confidence: ConfidenceLevel;
  reasons: string[];
  legalNotice?: string;
}

export interface ComparisonResult {
  metric: RankMetric;
  eligibleCount: number;
  totalAlternatives: number;
  bestAlternative?: RankedAlternative;
  rankedList: RankedAlternative[];
  refundGroup: RankedAlternative[];
  exchangeGroup: RankedAlternative[];
  hasMultipleEligible: boolean;
  comparisonNotice: string;
  globalWarnings: string[];
}

export interface AlternativeResult {
  alternative: AlternativeCode;
  name: string;
  status: AlternativeStatus;
  cashOutflow: number;
  economicCost: number;
  rankingEligible: boolean;
  notes?: string;
}

export interface CalculationResultSet {
  timestamp: string;
  inputs: ReturnInputs;
  flags: DecisionFlags;
  results: AlternativeResult[];
  recommendedAlternative?: AlternativeCode;
}
