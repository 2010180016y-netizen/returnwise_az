/**
 * ReturnWise Pro Architecture & Legal Scope Contract Tests (tests/e2e/pro_architecture.spec.ts)
 * Verifies Pro PRD, Zero Disruption of MVP, Cloudflare D1/R2/Workers ADR-0003 stack justification,
 * No-PII data models, retention & deletion policy, Toss Payments PG specs, and owner sign-off.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 특정 DB/Auth/PG 도구를 근거 없이 채택하지 말 것 (Detailed trade-off analysis).
 * 2. MVP 기능 무중단 유지 (Zero Disruption).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T33 | Pro Architecture, PRD & ADR Stack Contract', () => {
  describe('1. Pro 제품 요구사항 명세서 검증 (docs/PRO_PRD.md)', () => {
    const prdPath = path.resolve('docs/PRO_PRD.md');

    it('docs/PRO_PRD.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(prdPath), 'docs/PRO_PRD.md 파일이 존재해야 합니다.');
    });

    it('무료 MVP 무중단 보장(Zero Disruption) 대원칙이 명시되어야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(
        content.includes('무료 MVP 무중단') || content.includes('Zero Disruption'),
        '무료 MVP 무중단 보장 원칙이 명시되어야 합니다.'
      );
    });

    it('무료 vs Pro 기능 범위 매트릭스가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(content.includes('CSV 일괄 업로드'), 'CSV 일괄 기능이 정의되어야 합니다.');
      assert.ok(content.includes('손실 대시보드'), '손실 대시보드가 정의되어야 합니다.');
      assert.ok(content.includes('세무 정산 리포트'), '세무 정산 리포트가 정의되어야 합니다.');
    });

    it('5대 핵심 테이블(tenants, users, return_sessions, batch_jobs, subscriptions) 스키마가 포함되어야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(content.includes('CREATE TABLE tenants'), 'tenants 테이블이 포함되어야 합니다.');
      assert.ok(content.includes('CREATE TABLE users'), 'users 테이블이 포함되어야 합니다.');
      assert.ok(content.includes('CREATE TABLE return_sessions'), 'return_sessions 테이블이 포함되어야 합니다.');
      assert.ok(content.includes('CREATE TABLE batch_jobs'), 'batch_jobs 테이블이 포함되어야 합니다.');
      assert.ok(content.includes('CREATE TABLE subscriptions'), 'subscriptions 테이블이 포함되어야 합니다.');
    });

    it('데이터 보존 및 탈퇴 시 영구 파기 정책(Right to Erasure)이 수록되어야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(
        content.includes('회원 탈퇴 및 완전 영구 파기') || content.includes('ON DELETE CASCADE'),
        '영구 파기 정책이 명시되어야 합니다.'
      );
    });

    it('토스페이먼츠 PG 결제 연동 및 $0 유지비 구조가 명시되어야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(content.includes('토스페이먼츠') || content.includes('TOSS'), '토스페이먼츠 PG가 명시되어야 합니다.');
      assert.ok(content.includes('3.3% + 건당 33원'), '수수료율이 명시되어야 합니다.');
    });

    it('최종 승인자 서명란(PENDING_OWNER_SIGN_OFF)이 존재해야 한다', () => {
      const content = fs.readFileSync(prdPath, 'utf-8');
      assert.ok(
        content.includes('PENDING_OWNER_SIGN_OFF'),
        '대표님 승인 대기 서명란이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 기술 의사결정 기록 검증 (docs/ADR/0003-pro-stack.md)', () => {
    const adrPath = path.resolve('docs/ADR/0003-pro-stack.md');

    it('docs/ADR/0003-pro-stack.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(adrPath), 'docs/ADR/0003-pro-stack.md 파일이 존재해야 합니다.');
    });

    it('DB 대안(PostgreSQL, RDS, Cloudflare D1) 비교 및 D1 채택 근거가 수록되어야 한다', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('PostgreSQL') || content.includes('Supabase'), 'PostgreSQL 대안이 비교되어야 합니다.');
      assert.ok(content.includes('Cloudflare D1'), 'Cloudflare D1 채택이 명시되어야 합니다.');
    });

    it('Auth 대안(Auth0, 자체비밀번호, 매직링크) 비교 및 비밀번호 미보관 근거가 수록되어야 한다', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('Auth0') || content.includes('Clerk'), 'Auth 서드파티 대안이 비교되어야 합니다.');
      assert.ok(content.includes('매직링크') || content.includes('JWT'), '매직링크+JWT 채택이 명시되어야 합니다.');
    });

    it('PG 대안(Stripe, 자체보관금지, 토스페이먼츠) 비교 및 결제창 위임 근거가 수록되어야 한다', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(content.includes('Stripe'), 'Stripe 대안이 비교되어야 합니다.');
      assert.ok(
        content.includes('원천 금지') || content.includes('전자금융거래법'),
        '자체 카드번호 보관 금지가 명시되어야 합니다.'
      );
      assert.ok(content.includes('토스페이먼츠'), '토스페이먼츠 채택이 명시되어야 합니다.');
    });

    it('특정 도구를 근거 없이 채택하지 않는 안전조건이 준수되어야 한다 (특별 안전조건)', () => {
      const content = fs.readFileSync(adrPath, 'utf-8');
      assert.ok(
        content.includes('근거 없이 임의로 채택하지 않고') || content.includes('대안 평가'),
        '근거 중심 스택 비교 안전조건이 명시되어야 합니다.'
      );
    });
  });
});
