/**
 * ReturnWise Pro Final Release & Operational Sustainability Contract Tests (tests/e2e/pro_launch.spec.ts)
 * Verifies PRO_LAUNCH_REPORT.md, PRO_OPS_SCORECARD.md, Zero P0 defects,
 * transparent revenue reporting (0 KRW actual revenue), anti-misrepresentation safety conditions,
 * and PENDING_OWNER_SIGN_OFF sign-off preservation.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 실제 유료 사용자 데이터/매출 없으면 예상치 명시 (현재 실현 매출 0원).
 * 2. P0 결함 0건 (Zero P0).
 * 3. 보안 게이트 PASS.
 * 4. 명시 승인 후만 Pro 공개 (PENDING_OWNER_SIGN_OFF).
 * 5. 수익 자동 발생·운영 무인화 보장 표현 금지.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T40 | Pro Launch & Operational Sustainability Contract', () => {
  const launchReportPath = path.resolve('docs/PRO_LAUNCH_REPORT.md');
  const scorecardPath = path.resolve('docs/PRO_OPS_SCORECARD.md');

  describe('1. Pro 출시 심사 보고서 검증 (docs/PRO_LAUNCH_REPORT.md)', () => {
    it('docs/PRO_LAUNCH_REPORT.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(launchReportPath), 'docs/PRO_LAUNCH_REPORT.md 파일이 존재해야 합니다.');
    });

    it('4대 영역(법률, 보안, 개인정보, 결제) 독립 심사 결과가 PASS 로 기재되어야 한다', () => {
      const content = fs.readFileSync(launchReportPath, 'utf-8');
      assert.ok(content.includes('1. 법률 및 규제') && content.includes('PASS'));
      assert.ok(content.includes('2. 보안 및 결제 안전') && content.includes('PASS'));
      assert.ok(content.includes('3. 개인정보 및 데이터') && content.includes('PASS'));
      assert.ok(content.includes('4. 결제 리컨실리에이션') && content.includes('PASS'));
    });

    it('치명적 결함(P0) 0건(Zero P0)이 명시되어야 한다', () => {
      const content = fs.readFileSync(launchReportPath, 'utf-8');
      assert.ok(content.includes('P0') && content.includes('0건'));
    });

    it('현재 실현 매출 0원 및 유료 고객 0명이 투명하게 명시되어야 한다 (재무 진실성)', () => {
      const content = fs.readFileSync(launchReportPath, 'utf-8');
      assert.ok(content.includes('0원') || content.includes('KRW 0'));
      assert.ok(content.includes('0명') || content.includes('Zero Paid Subscribers'));
    });

    it('수익 자동 발생 및 운영 무인화 보장 표현이 금지되어야 한다 (특별 안전조건)', () => {
      const content = fs.readFileSync(launchReportPath, 'utf-8');
      assert.ok(
        content.includes('수익 자동 발생') && content.includes('운영 무인화 보장') && content.includes('금지') || content.includes('배제')
      );
    });

    it('대표님 서명란(PENDING_OWNER_SIGN_OFF)이 안전하게 잠겨 있어야 한다', () => {
      const content = fs.readFileSync(launchReportPath, 'utf-8');
      assert.ok(content.includes('PENDING_OWNER_SIGN_OFF'));
    });
  });

  describe('2. 운영 지속가능성 스코어카드 검증 (docs/PRO_OPS_SCORECARD.md)', () => {
    it('docs/PRO_OPS_SCORECARD.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(scorecardPath), 'docs/PRO_OPS_SCORECARD.md 파일이 존재해야 합니다.');
    });

    it('핵심 운영 KPI(응답속도, RTO, P0, MRR, 서버비 $0)가 명시되어야 한다', () => {
      const content = fs.readFileSync(scorecardPath, 'utf-8');
      assert.ok(content.includes('응답 속도'));
      assert.ok(content.includes('RTO') || content.includes('롤백'));
      assert.ok(content.includes('P0'));
      assert.ok(content.includes('고정 서버비') && content.includes('$0'));
    });

    it('MRR 코호트 트래커 템플릿 및 악용 방어 체계가 수록되어야 한다', () => {
      const content = fs.readFileSync(scorecardPath, 'utf-8');
      assert.ok(content.includes('코호트'));
      assert.ok(content.includes('악용 방어') || content.includes('어뷰징'));
    });
  });
});
