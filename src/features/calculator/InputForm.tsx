/**
 * ReturnWise Input Form (src/features/calculator/InputForm.tsx)
 * Controlled form for return context, legal gates, and KRW financial inputs.
 * Strictly enforces No-PII (no orderId, customerName, phone, address).
 */

import React, { useRef, useState } from 'react';
import { RawInputFields } from './useCalculatorState';
import {
  saveDefaults,
  loadSavedDefaults,
  clearSavedDefaults,
  NonSensitiveDefaults,
} from '../../lib/storage';
import {
  Button,
  Input,
  FormField,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Alert,
  Tooltip,
} from '../../components';
import { ReturnReason, BuyerRequest, PlatformType, DecisionFlags } from '../../domain/types';

export interface InputFormProps {
  rawInputs: RawInputFields;
  flags: DecisionFlags;
  inputErrors: Record<string, string>;
  onUpdateInput: (key: keyof RawInputFields, value: string) => void;
  onUpdateFlag: <K extends keyof DecisionFlags>(key: K, value: DecisionFlags[K]) => void;
  onLoadExampleC01: () => void;
  onLoadExampleC03: () => void;
  onResetAll: () => void;
  onSubmit?: (e: React.FormEvent) => void;
}

/**
 * 한국어 금액 읽기 보조 텍스트 (예: 30000 -> "3만 원", 15000 -> "1만 5,000원")
 */
function getKoreanAmountHelp(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;
  const num = Number(raw.replace(/,/g, ''));
  if (isNaN(num)) return null;
  if (num === 0) return '0원 (명시적 0원 입력)';

  const eok = Math.floor(num / 100_000_000);
  const man = Math.floor((num % 100_000_000) / 10_000);
  const remainder = num % 10_000;

  let result = '';
  if (eok > 0) result += `${eok}억 `;
  if (man > 0) result += `${man}만 `;
  if (remainder > 0) result += `${remainder.toLocaleString('ko-KR')}`;
  result += '원';

  return result.trim();
}

export const InputForm: React.FC<InputFormProps> = ({
  rawInputs,
  flags,
  inputErrors,
  onUpdateInput,
  onUpdateFlag,
  onLoadExampleC01,
  onLoadExampleC03,
  onResetAll,
  onSubmit,
}) => {
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const [saveConsent, setSaveConsent] = useState<boolean>(false);
  const [storageFeedback, setStorageFeedback] = useState<string | null>(null);

  const handleSaveDefaults = () => {
    if (!saveConsent) {
      setStorageFeedback('동의 체크박스를 선택한 후 저장을 눌러주세요.');
      return;
    }
    const defaultsToSave: NonSensitiveDefaults = {
      reverseShippingSellerCost: parseInt(rawInputs.reverseShippingSellerCost.replace(/,/g, ''), 10) || undefined,
      handlingCost: parseInt(rawInputs.handlingCost.replace(/,/g, ''), 10) || undefined,
      replacementOutboundShipping: parseInt(rawInputs.replacementOutboundShipping.replace(/,/g, ''), 10) || undefined,
      platform: flags.platform,
    };
    const ok = saveDefaults(defaultsToSave, true);
    if (ok) {
      setStorageFeedback('판매자 기본값(배송비/검수비)이 브라우저에 저장되었습니다 (90일 유효).');
    } else {
      setStorageFeedback('저장에 실패했거나 브라우저에서 스토리지가 차단되었습니다.');
    }
  };

  const handleLoadDefaults = () => {
    const saved = loadSavedDefaults();
    if (!saved) {
      setStorageFeedback('저장된 유효한 기본값이 없습니다.');
      return;
    }
    if (saved.reverseShippingSellerCost !== undefined) {
      onUpdateInput('reverseShippingSellerCost', saved.reverseShippingSellerCost.toLocaleString('ko-KR'));
    }
    if (saved.handlingCost !== undefined) {
      onUpdateInput('handlingCost', saved.handlingCost.toLocaleString('ko-KR'));
    }
    if (saved.replacementOutboundShipping !== undefined) {
      onUpdateInput('replacementOutboundShipping', saved.replacementOutboundShipping.toLocaleString('ko-KR'));
    }
    if (saved.platform) {
      onUpdateFlag('platform', saved.platform);
    }
    setStorageFeedback('저장된 판매자 기본값을 불러왔습니다.');
  };

  const handleClearDefaults = () => {
    clearSavedDefaults();
    setStorageFeedback('저장된 판매자 기본값이 완전히 삭제되었습니다.');
  };

  const handleNumberChange = (key: keyof RawInputFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '');
    const formatted = rawVal ? Number(rawVal).toLocaleString('ko-KR') : '';
    onUpdateInput(key, formatted);
  };

  const focusField = (fieldId: string) => {
    const el = fieldRefs.current[fieldId];
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const errorKeys = Object.keys(inputErrors).filter((k) => Boolean(inputErrors[k]));
  const hasErrors = errorKeys.length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (onSubmit) onSubmit(e);
      }}
      noValidate
      className="rw-stack"
    >
      {/* 1. Validation Summary Banner */}
      {hasErrors && (
        <Alert type="error" title="입력값 오류를 확인해 주세요" role="alert">
          <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, fontSize: '0.8125rem' }}>
            {errorKeys.map((key) => (
              <li key={key} style={{ margin: '0.125rem 0' }}>
                <button
                  type="button"
                  onClick={() => focusField(key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--color-danger-700)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {inputErrors[key]} (클릭하여 해당 필드로 이동)
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* 2. Presets & Default Examples */}
      <div className="rw-card" style={{ padding: '0.875rem 1rem' }}>
        <div className="rw-flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
              ⚡ 빠른 예시 불러오기
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-slate-500)', marginLeft: '0.5rem' }}>
              검증된 표준 시나리오 데이터를 원클릭으로 채웁니다.
            </span>
          </div>
          <div className="rw-flex" style={{ gap: '0.375rem', flexWrap: 'wrap' }}>
            <Button type="button" variant="outline" size="sm" onClick={onLoadExampleC01}>
              📌 표준 반품(C01) 불러오기
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onLoadExampleC03}>
              🤝 부분환불 합의(C03) 불러오기
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onResetAll}>
              🔄 전체 초기화
            </Button>
          </div>
        </div>
      </div>

      {/* 3. STEP 1: 반품 상황 및 플랫폼 (Context & Reason) */}
      <section id="step-context" className="rw-card">
        <CardHeader>
          <div className="rw-flex" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="info">STEP 1</Badge>
            <CardTitle>상황 및 권리 확인 (Context & Reason)</CardTitle>
          </div>
          <CardDescription>
            반품 사유 및 귀책, 판매 플랫폼, 고객 요청을 선택하고 법률 필수 합의 요건을 점검합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="rw-stack">
          <div className="rw-grid-2">
            {/* 귀책 사유 */}
            <FormField
              id="field-reason"
              label="반품 귀책 사유"
              required
              helpText="소비자 단순변심과 판매자 귀책을 구분합니다."
              tooltip={<Tooltip content="전자상거래법 제18조 제9항에 따라 판매자 귀책 시 반품 배송비를 고객에게 청구할 수 없습니다." />}
            >
              <select
                id="field-reason"
                ref={(el) => { fieldRefs.current['reason'] = el; }}
                className="rw-input"
                value={flags.reason}
                onChange={(e) => onUpdateFlag('reason', e.target.value as ReturnReason)}
                aria-label="반품 귀책 사유"
              >
                <option value="BUYER_REMORSE">소비자 단순변심 (고객 배송비 부담 원칙)</option>
                <option value="SELLER_FAULT">판매자 귀책 (오배송, 상품 하자, 파손 등)</option>
                <option value="DEFECT_OR_DIFF">표시·광고 상이 (계약 내용 불일치)</option>
                <option value="UNKNOWN_REASON">미확인 / 사유 불명 (안전을 위해 모든 추천 차단)</option>
              </select>
            </FormField>

            {/* 고객 요청 */}
            <FormField
              id="field-buyer-request"
              label="고객의 요청 사항"
              required
              helpText="고객이 접수한 초기 처리 요구사항입니다."
            >
              <select
                id="field-buyer-request"
                ref={(el) => { fieldRefs.current['buyerRequest'] = el; }}
                className="rw-input"
                value={flags.buyerRequest}
                onChange={(e) => onUpdateFlag('buyerRequest', e.target.value as BuyerRequest)}
                aria-label="고객의 요청 사항"
              >
                <option value="REFUND">전액 환불 (청약철회 요청)</option>
                <option value="EXCHANGE">1:1 교환 (동일/대체 상품 맞교환)</option>
                <option value="UNKNOWN">미확인 / 고객 의사 미접수</option>
              </select>
            </FormField>
          </div>

          <div className="rw-grid-2">
            {/* 판매 플랫폼 */}
            <FormField
              id="field-platform"
              label="판매 마켓 (플랫폼)"
              helpText="마켓별 부분환불 지원 정책 및 수수료 정산 기준"
            >
              <select
                id="field-platform"
                ref={(el) => { fieldRefs.current['platform'] = el; }}
                className="rw-input"
                value={flags.platform}
                onChange={(e) => onUpdateFlag('platform', e.target.value as PlatformType)}
                aria-label="판매 마켓"
              >
                <option value="NAVER">네이버 스마트스토어</option>
                <option value="COUPANG">쿠팡 (윙 / 로켓그로스)</option>
                <option value="INDEPENDENT">자사몰 / 독립몰</option>
                <option value="OTHER">기타 외부 마켓 (약관 수동 확인)</option>
              </select>
            </FormField>

            {/* 청약철회 특례 품목 */}
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '1.25rem' }}>
              <label className="rw-flex" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(flags.isSpecialItem)}
                  onChange={(e) => onUpdateFlag('isSpecialItem', e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span>식품·위생·주문제작 등 청약철회 특례 품목 (L07 안내)</span>
              </label>
            </div>
          </div>

          {/* 법률 게이트 점검 체크박스 */}
          <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)' }} className="rw-stack-sm">
            <strong style={{ fontSize: '0.875rem', color: 'var(--color-slate-800)' }}>
              ⚖️ 필수 권리 및 법률 게이트 점검 (Fail-closed)
            </strong>
            <label className="rw-flex" style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flags.voluntaryAgreementConfirmed}
                onChange={(e) => onUpdateFlag('voluntaryAgreementConfirmed', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <strong>[부분환불 요건 1]</strong> 소비자가 상품을 보유한 채 일정 금액만 환급받는 부분환불에 자발적으로 합의했습니다 (미체크 시 추천 차단 - L03).
              </span>
            </label>
            <label className="rw-flex" style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flags.permittedByPolicyConfirmed}
                onChange={(e) => onUpdateFlag('permittedByPolicyConfirmed', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <strong>[부분환불 요건 2]</strong> 판매 마켓 시스템상 부분환불 처리가 허용됨을 확인했습니다 (L04).
              </span>
            </label>
            <label className="rw-flex" style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={flags.rightsNotRestrictedConfirmed}
                onChange={(e) => onUpdateFlag('rightsNotRestrictedConfirmed', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <strong>[부분환불 요건 3]</strong> 소비자의 법정 전액 청약철회 권리가 부당하게 제한되지 않음을 확인했습니다 (L05).
              </span>
            </label>
            {flags.buyerRequest === 'REFUND' && (
              <label className="rw-flex" style={{ fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={flags.buyerAgreedExchange}
                  onChange={(e) => onUpdateFlag('buyerAgreedExchange', e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>
                  <strong>[교환 요건]</strong> 환불을 요청한 고객이 교환 제안에 명시적으로 사전 동의했습니다 (미체크 시 교환 강요 방지 차단 - L06).
                </span>
              </label>
            )}
          </div>
        </CardContent>
      </section>

      {/* 4. STEP 2: 비용 및 금액 입력 (Financial Inputs) */}
      <section id="step-inputs" className="rw-card">
        <CardHeader>
          <div className="rw-flex" style={{ gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Badge variant="info">STEP 2</Badge>
            <CardTitle>비용 및 금액 입력 (Financial Inputs)</CardTitle>
          </div>
          <CardDescription>
            실제 원 단위 금액을 입력합니다. 필수 항목 1개를 제외한 나머지는 선택 항목이며, 미입력 시 0원으로 자동 계산됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="rw-stack">
          {/* 주요 필수 및 반품 비용 */}
          <div className="rw-grid-2">
            <FormField
              id="field-refund-amount"
              label="환급 예정 금액"
              required
              error={inputErrors.refundAmount}
              helpText={getKoreanAmountHelp(rawInputs.refundAmount) || '소비자에게 결제 취소 또는 계좌로 돌려줄 원거래 금액'}
              tooltip={<Tooltip content="원거래 배송비가 포함되어 환불되는 경우 배송비를 포함한 총 환급액을 입력해 주세요." />}
            >
              <Input
                id="field-refund-amount"
                ref={(el) => { fieldRefs.current['refundAmount'] = el; }}
                suffix="원"
                value={rawInputs.refundAmount}
                onChange={handleNumberChange('refundAmount')}
                isError={Boolean(inputErrors.refundAmount)}
                placeholder="예: 30,000"
                aria-required="true"
              />
            </FormField>

            <FormField
              id="field-reverse-shipping-seller"
              label="판매자 부담 회수 운송비"
              error={inputErrors.reverseShippingSellerCost}
              helpText={getKoreanAmountHelp(rawInputs.reverseShippingSellerCost) || '택배사 계약 운임 등 판매자가 실제로 지불하는 편도/왕복 회수 택배비'}
              tooltip={<Tooltip content="고객이 이미 지불했거나 차감 공제되는 운임은 제외하고 순수 판매자가 지출하는 운임만 입력합니다." />}
            >
              <Input
                id="field-reverse-shipping-seller"
                ref={(el) => { fieldRefs.current['reverseShippingSellerCost'] = el; }}
                suffix="원"
                value={rawInputs.reverseShippingSellerCost}
                onChange={handleNumberChange('reverseShippingSellerCost')}
                isError={Boolean(inputErrors.reverseShippingSellerCost)}
                placeholder="예: 3,500 (0원 입력 시 0원 계산)"
              />
            </FormField>
          </div>

          <div className="rw-grid-2">
            <FormField
              id="field-handling-cost"
              label="처리·검수·재포장비 (선택)"
              error={inputErrors.handlingCost}
              helpText={getKoreanAmountHelp(rawInputs.handlingCost) || '창고 입고 검수, 새 박스/완충재 교체, 재바코드 부착 인건비'}
            >
              <Input
                id="field-handling-cost"
                ref={(el) => { fieldRefs.current['handlingCost'] = el; }}
                suffix="원"
                value={rawInputs.handlingCost}
                onChange={handleNumberChange('handlingCost')}
                isError={Boolean(inputErrors.handlingCost)}
                placeholder="예: 1,000"
              />
            </FormField>

            <FormField
              id="field-recovered-item-value"
              label="회수 상품의 보수적 순가치 (선택)"
              error={inputErrors.recoveredItemNetValue}
              helpText={getKoreanAmountHelp(rawInputs.recoveredItemNetValue) || '재판매, 리퍼브, 부품 처분 시 실제로 회수 가능한 순금액 (비현금 자산)'}
              tooltip={<Tooltip content="원래 판매가나 원가가 아니며, 재포장 후 다시 판매할 수 있는 보수적인 처분 가치입니다. 폐기 시 0원을 입력하세요." />}
            >
              <Input
                id="field-recovered-item-value"
                ref={(el) => { fieldRefs.current['recoveredItemNetValue'] = el; }}
                suffix="원"
                value={rawInputs.recoveredItemNetValue}
                onChange={handleNumberChange('recoveredItemNetValue')}
                isError={Boolean(inputErrors.recoveredItemNetValue)}
                placeholder="예: 9,000 (폐기 시 0)"
              />
            </FormField>
          </div>

          {/* 수수료 및 부분환불 금액 */}
          <div className="rw-grid-2">
            <FormField
              id="field-fee-credit"
              label="확정 수수료 환급액 (선택)"
              error={inputErrors.feeReversalCredit}
              helpText={getKoreanAmountHelp(rawInputs.feeReversalCredit) || '반품 승인 시 마켓에서 판매자에게 정산 돌려주는 결제수수료 크레딧'}
            >
              <Input
                id="field-fee-credit"
                ref={(el) => { fieldRefs.current['feeReversalCredit'] = el; }}
                suffix="원"
                value={rawInputs.feeReversalCredit}
                onChange={handleNumberChange('feeReversalCredit')}
                isError={Boolean(inputErrors.feeReversalCredit)}
                placeholder="예: 0"
              />
            </FormField>

            <FormField
              id="field-agreed-partial-refund"
              label="소비자 합의된 부분환급액 (선택)"
              error={inputErrors.agreedPartialRefund}
              helpText={getKoreanAmountHelp(rawInputs.agreedPartialRefund) || '소비자가 상품을 소장하는 조건으로 돌려주기로 합의한 금액 (대안 3 전용)'}
              tooltip={<Tooltip content="부분환불액은 전액환불액을 초과할 수 없습니다." />}
            >
              <Input
                id="field-agreed-partial-refund"
                ref={(el) => { fieldRefs.current['agreedPartialRefund'] = el; }}
                suffix="원"
                value={rawInputs.agreedPartialRefund}
                onChange={handleNumberChange('agreedPartialRefund')}
                isError={Boolean(inputErrors.agreedPartialRefund)}
                placeholder="예: 15,000"
              />
            </FormField>
          </div>

          {/* 교환 관련 금액 */}
          <div className="rw-grid-2">
            <FormField
              id="field-replacement-cost"
              label="교환용 새 상품 사입원가 (선택)"
              error={inputErrors.replacementCost}
              helpText={getKoreanAmountHelp(rawInputs.replacementCost) || '1:1 맞교환 시 새로 출고하는 상품 1개의 제조/매입 원가 (대안 4 전용)'}
            >
              <Input
                id="field-replacement-cost"
                ref={(el) => { fieldRefs.current['replacementCost'] = el; }}
                suffix="원"
                value={rawInputs.replacementCost}
                onChange={handleNumberChange('replacementCost')}
                isError={Boolean(inputErrors.replacementCost)}
                placeholder="예: 12,000"
              />
            </FormField>

            <FormField
              id="field-replacement-shipping"
              label="교환 상품 출고 배송비 (선택)"
              error={inputErrors.replacementOutboundShipping}
              helpText={getKoreanAmountHelp(rawInputs.replacementOutboundShipping) || '맞교환 새 상품을 고객에게 다시 보낼 때 발생하는 편도 배송비'}
            >
              <Input
                id="field-replacement-shipping"
                ref={(el) => { fieldRefs.current['replacementOutboundShipping'] = el; }}
                suffix="원"
                value={rawInputs.replacementOutboundShipping}
                onChange={handleNumberChange('replacementOutboundShipping')}
                isError={Boolean(inputErrors.replacementOutboundShipping)}
                placeholder="예: 3,000"
              />
            </FormField>
          </div>

          {/* 판매자 고정 기본값 로컬 저장 컨트롤 (T16) */}
          <div style={{ background: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-slate-200)', marginTop: '0.5rem' }} className="rw-stack-sm">
            <div className="rw-flex-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <label className="rw-flex" style={{ fontSize: '0.8125rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={saveConsent}
                  onChange={(e) => {
                    setSaveConsent(e.target.checked);
                    if (!e.target.checked) setStorageFeedback(null);
                  }}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 600, color: 'var(--color-slate-800)' }}>
                  판매자 기본값(배송비·검수비) 이 브라우저에 저장
                </span>
              </label>

              <div className="rw-flex" style={{ gap: '0.375rem' }}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDefaults}
                  disabled={!saveConsent}
                  style={{ fontSize: '0.75rem', minHeight: 32 }}
                >
                  기본값 저장
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleLoadDefaults}
                  style={{ fontSize: '0.75rem', minHeight: 32 }}
                >
                  저장값 불러오기
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearDefaults}
                  style={{ fontSize: '0.75rem', minHeight: 32, color: 'var(--color-danger-600)' }}
                >
                  저장값 삭제
                </Button>
              </div>
            </div>

            <p style={{ fontSize: '0.6875rem', color: 'var(--color-slate-500)', margin: 0 }}>
              ℹ️ 판매자 부담 배송비와 검수비만 브라우저 로컬 스토리지에 보관되며(최대 90일), 주문별 환급액이나 개인정보는 절대 저장되지 않습니다.
            </p>

            {storageFeedback && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', fontWeight: 600, margin: 0 }}>
                {storageFeedback}
              </p>
            )}
          </div>
        </CardContent>
      </section>
    </form>
  );
};

export default InputForm;
