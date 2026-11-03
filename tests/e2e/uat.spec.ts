/**
 * ReturnWise UAT & Launch Approval Contract Tests (tests/e2e/uat.spec.ts)
 * Verifies 10 core UAT user scenarios, zero P0 defects, legal disclaimers,
 * human launch dossier, and strict prohibition of AI proxy signing.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. AI가 사용자의 승인·법률 전문가 의견을 대리 서명 금지.
 * 2. UAT 결함 P0 = 0건 엄수.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T26 | Operator UAT & Launch Approval Contract', () => {
  describe('1. UAT 보고서 및 결함 점검 (docs/UAT_REPORT.md)', () => {
    const reportPath = path.resolve('docs/UAT_REPORT.md');

    it('docs/UAT_REPORT.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(reportPath), 'docs/UAT_REPORT.md 파일이 존재해야 합니다.');
    });

    it('10개 핵심 사용자 시나리오(UAT-01 ~ UAT-10)가 모두 포함되어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      for (let i = 1; i <= 10; i++) {
        const id = `UAT-${i < 10 ? '0' + i : i}`;
        assert.ok(content.includes(id), `시나리오 ${id}가 UAT 보고서에 포함되어야 합니다.`);
      }
    });

    it('치명적 결함(P0) 및 주요 결함(P1)이 0건이어야 한다 (Zero P0/P1 Blocker)', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('P0 = 0건') || content.includes('P0=0'),
        'P0 결함이 0건이어야 합니다.'
      );
      assert.ok(
        content.includes('P1 = 0건') || content.includes('P1=0'),
        'P1 결함이 0건이어야 합니다.'
      );
    });

    it('실제 사용자 3~5인 대상 사용성 테스트 계획이 포함되어야 한다', () => {
      const content = fs.readFileSync(reportPath, 'utf-8');
      assert.ok(
        content.includes('유용성 테스트') || content.includes('Usability Test'),
        '사용성 테스트 섹션이 포함되어야 합니다.'
      );
    });
  });

  describe('2. 런칭 도시에 및 사람 승인서 검증 (docs/LAUNCH_APPROVAL.md)', () => {
    const approvalPath = path.resolve('docs/LAUNCH_APPROVAL.md');

    it('docs/LAUNCH_APPROVAL.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(approvalPath), 'docs/LAUNCH_APPROVAL.md 파일이 존재해야 합니다.');
    });

    it('법률·출처·문구·운영자표시·개인정보 고지 체크리스트가 포함되어야 한다', () => {
      const content = fs.readFileSync(approvalPath, 'utf-8');
      assert.ok(content.includes('2026 전자상거래법 출처 확인'), '법률 출처 확인 항목이 포함되어야 합니다.');
      assert.ok(content.includes('법률·세무 비자문 면책 고지 확인'), '비자문 면책 고지 항목이 포함되어야 합니다.');
      assert.ok(content.includes('개인정보 미수집 증빙 확인'), '개인정보 미수집 확인 항목이 포함되어야 합니다.');
      assert.ok(content.includes('운영자 정보 대외 고지 상태'), '운영자 정보 확인 항목이 포함되어야 합니다.');
    });

    it('사람 서명란이 명시되어 있고, AI 대리 서명이 엄격히 금지되어야 한다 (특별 안전조건)', () => {
      const content = fs.readFileSync(approvalPath, 'utf-8');
      assert.ok(
        content.includes('김회기') || content.includes('김 회 기'),
        '사람 운영자(김회기) 서명 대상이 명시되어야 합니다.'
      );
      assert.ok(
        content.includes('PENDING_HUMAN_SIGNATURE') || content.includes('사람 서명 대기'),
        '현재 상태가 사람 서명 대기로 봉인되어야 합니다.'
      );
      assert.ok(
        (content.includes('AI') || content.includes('인공지능')) && content.includes('대리 서명'),
        'AI 대리 서명 금지 안전 고지가 명시되어야 합니다.'
      );
    });
  });
});
