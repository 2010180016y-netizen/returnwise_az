/**
 * ReturnWise Pro Payment Design & Billing State Machine Contract Tests (tests/security/payments_design.spec.ts)
 * Verifies PG ADR (Toss Payments selection, Zero-PCI risk, VAT 10%, 7-day refund),
 * 6-state billing state machine, idempotency key pattern, sandbox plan, and safety rules.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 직접 카드정보 수집 및 저장 금지 (Zero-PCI Risk).
 * 2. 실계약 및 실제 카드 결제 자동 실행 금지 (실 결제 0건).
 * 3. 결재자(김회기 대표님) 명시적 서명란 보존 (PENDING_OWNER_SIGN_OFF).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

type BillingState = 'UNPAID' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'REFUNDED';
type BillingEvent =
  | 'START_TRIAL'
  | 'BILLING_SUCCESS'
  | 'BILLING_FAILURE'
  | 'RETRY_SUCCESS'
  | 'GRACE_EXPIRED'
  | 'USER_CANCEL'
  | 'PROCESS_REFUND';

function transitionBillingState(current: BillingState, event: BillingEvent): BillingState {
  switch (current) {
    case 'UNPAID':
      if (event === 'START_TRIAL') return 'TRIAL';
      if (event === 'BILLING_SUCCESS') return 'ACTIVE';
      break;
    case 'TRIAL':
      if (event === 'BILLING_SUCCESS') return 'ACTIVE';
      if (event === 'BILLING_FAILURE' || event === 'USER_CANCEL') return 'CANCELED';
      break;
    case 'ACTIVE':
      if (event === 'BILLING_FAILURE') return 'PAST_DUE';
      if (event === 'USER_CANCEL') return 'CANCELED';
      if (event === 'PROCESS_REFUND') return 'REFUNDED';
      break;
    case 'PAST_DUE':
      if (event === 'RETRY_SUCCESS') return 'ACTIVE';
      if (event === 'GRACE_EXPIRED' || event === 'USER_CANCEL') return 'CANCELED';
      break;
    case 'CANCELED':
      if (event === 'BILLING_SUCCESS') return 'ACTIVE';
      if (event === 'PROCESS_REFUND') return 'REFUNDED';
      break;
    case 'REFUNDED':
      if (event === 'BILLING_SUCCESS') return 'ACTIVE';
      break;
  }
  return current;
}

describe('T38 | Payment Architecture & Billing State Machine Contract', () => {
  describe('1. 결제 의사결정서 검증 (docs/PAYMENTS_ADR.md)', () => {
    const adrFile = path.resolve('docs/PAYMENTS_ADR.md');

    it('docs/PAYMENTS_ADR.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(adrFile), 'docs/PAYMENTS_ADR.md 파일이 존재해야 합니다.');
    });

    it('국내 4대 PG사 비교 및 토스페이먼츠 채택 근거가 수록되어야 한다', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(content.includes('토스페이먼츠') || content.includes('Toss Payments'));
      assert.ok(content.includes('포트원') || content.includes('PortOne'));
      assert.ok(content.includes('KG이니시스'));
      assert.ok(content.includes('NHN KCP'));
      assert.ok(content.includes('최종 채택 (ACCEPTED)'));
    });

    it('직접 카드정보 수집 금지 안전조건이 수록되어야 한다 (특별 안전조건 1)', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(
        content.includes('직접 카드정보 수집 및 저장 절대 금지') || content.includes('Zero-PCI'),
        '직접 카드정보 수집 금지 안전조건이 명시되어야 합니다.'
      );
    });

    it('실계약/카드 결제 자동 실행 금지 안전조건이 수록되어야 한다 (특별 안전조건 2)', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(
        content.includes('실제 카드 결제 자동 실행 금지') || content.includes('실 결제 요청 0건'),
        '실 결제 자동 실행 금지 안전조건이 명시되어야 합니다.'
      );
    });

    it('부가세(VAT 10%) 포함 가격 표시 및 7일 환불 규정이 명시되어야 한다', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(content.includes('부가가치세') && content.includes('10%'));
      assert.ok(content.includes('7일 이내') && content.includes('전액 환불'));
    });

    it('샌드박스(Sandbox) 테스트 시나리오가 포함되어야 한다', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(content.includes('샌드박스') || content.includes('Sandbox'));
      assert.ok(content.includes('test_ck_') || content.includes('가상 테스트 카드'));
    });

    it('결재자(김회기 대표님) 서명란(PENDING_OWNER_SIGN_OFF)이 존재해야 한다', () => {
      const content = fs.readFileSync(adrFile, 'utf-8');
      assert.ok(content.includes('PENDING_OWNER_SIGN_OFF'));
    });
  });

  describe('2. 정기결제 상태머신 명세 검증 (docs/BILLING_STATE_MACHINE.md)', () => {
    const smFile = path.resolve('docs/BILLING_STATE_MACHINE.md');

    it('docs/BILLING_STATE_MACHINE.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(smFile), 'docs/BILLING_STATE_MACHINE.md 파일이 존재해야 합니다.');
    });

    it('6대 결제 상태(UNPAID, TRIAL, ACTIVE, PAST_DUE, CANCELED, REFUNDED)가 정의되어야 한다', () => {
      const content = fs.readFileSync(smFile, 'utf-8');
      assert.ok(content.includes('`UNPAID`'));
      assert.ok(content.includes('`TRIAL`'));
      assert.ok(content.includes('`ACTIVE`'));
      assert.ok(content.includes('`PAST_DUE`'));
      assert.ok(content.includes('`CANCELED`'));
      assert.ok(content.includes('`REFUNDED`'));
    });

    it('멱등성 키 규격 및 D+1, D+3, D+7 재시도 정책이 수록되어야 한다', () => {
      const content = fs.readFileSync(smFile, 'utf-8');
      assert.ok(content.includes('Idempotency-Key') || content.includes('멱등성 키'));
      assert.ok(content.includes('D+1') && content.includes('D+3') && content.includes('D+7'));
    });
  });

  describe('3. 결제 상태머신 전이 시뮬레이션 검증', () => {
    it('초기 미결제(UNPAID)에서 체험(TRIAL) 및 결제 성공(ACTIVE)으로 정상 전이되어야 한다', () => {
      let state: BillingState = 'UNPAID';
      state = transitionBillingState(state, 'START_TRIAL');
      assert.strictEqual(state, 'TRIAL');

      state = transitionBillingState(state, 'BILLING_SUCCESS');
      assert.strictEqual(state, 'ACTIVE');
    });

    it('ACTIVE 상태에서 결제 실패 시 PAST_DUE 로 전이되고, 재시도 성공 시 ACTIVE 로 복구되어야 한다', () => {
      let state: BillingState = 'ACTIVE';
      state = transitionBillingState(state, 'BILLING_FAILURE');
      assert.strictEqual(state, 'PAST_DUE');

      // 재시도 성공
      state = transitionBillingState(state, 'RETRY_SUCCESS');
      assert.strictEqual(state, 'ACTIVE');
    });

    it('PAST_DUE 상태에서 유예 기간 만료 시 CANCELED 로 전이되어야 한다', () => {
      let state: BillingState = 'PAST_DUE';
      state = transitionBillingState(state, 'GRACE_EXPIRED');
      assert.strictEqual(state, 'CANCELED');
    });

    it('사용자 환불 처리 시 REFUNDED 상태로 전이되어야 한다', () => {
      let state: BillingState = 'ACTIVE';
      state = transitionBillingState(state, 'PROCESS_REFUND');
      assert.strictEqual(state, 'REFUNDED');
    });
  });
});
