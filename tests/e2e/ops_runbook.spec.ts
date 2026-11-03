/**
 * ReturnWise Ops Runbook & Cost Ledger Contract Tests (tests/e2e/ops_runbook.spec.ts)
 * Verifies incident severity levels, rollback reproducibility, tabletop exercises,
 * zero data backup statelessness, asynchronous CS routing, cost ledger, and safety rules.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 24x7 모니터링·법률 최신성 자동 보장 주장 금지.
 * 2. 월 운영비 예상/실제 구분 ($0 무자본 인프라 실측).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T28 | Operations, Incident Response & Cost Ledger Contract', () => {
  describe('1. 운영 및 장애대응 런북 검증 (docs/OPS_RUNBOOK.md)', () => {
    const runbookPath = path.resolve('docs/OPS_RUNBOOK.md');

    it('docs/OPS_RUNBOOK.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(runbookPath), 'docs/OPS_RUNBOOK.md 파일이 존재해야 합니다.');
    });

    it('P0, P1, P2, P3 장애 등급 체계가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(content.includes('P0 (Blocker)'), 'P0 장애 등급이 정의되어야 합니다.');
      assert.ok(content.includes('P1 (Critical)'), 'P1 장애 등급이 정의되어야 합니다.');
      assert.ok(content.includes('P2 (Major)'), 'P2 장애 등급이 정의되어야 합니다.');
      assert.ok(content.includes('P3 (Minor)'), 'P3 장애 등급이 정의되어야 합니다.');
    });

    it('긴급 Safe Mode 및 원클릭 롤백 절차가 기술되어야 한다', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(
        content.includes('Safe Mode') || content.includes('안전모드'),
        'Safe Mode 절차가 명시되어야 합니다.'
      );
      assert.ok(
        content.includes('Rollback to this deployment') || content.includes('롤백 실행'),
        '원클릭 롤백 절차가 명시되어야 합니다.'
      );
    });

    it('주간 운영 확인표와 월간 법령·정책 확인표가 포함되어야 한다', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(
        content.includes('주간 운영 확인표') || content.includes('Weekly Ops Checklist'),
        '주간 확인표가 포함되어야 합니다.'
      );
      assert.ok(
        content.includes('월간 법령') || content.includes('Monthly Legal'),
        '월간 법령 확인표가 포함되어야 합니다.'
      );
    });

    it('테이블탑 사고 연습 2회가 구체적인 단계별 시뮬레이션으로 수록되어야 한다', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(
        content.includes('연습 1') || content.includes('Tabletop Exercise 1'),
        '사고 연습 1이 수록되어야 합니다.'
      );
      assert.ok(
        content.includes('연습 2') || content.includes('Tabletop Exercise 2'),
        '사고 연습 2가 수록되어야 합니다.'
      );
    });

    it('서버 무상태성(Statelessness)에 따른 데이터 백업 불필요성이 명시되어야 한다', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(
        content.includes('서버 무상태') || content.includes('Stateless'),
        '서버 무상태성이 명시되어야 합니다.'
      );
      assert.ok(
        content.includes('백업 불필요') || content.includes('백업 대상 서버 데이터가 존재하지 않'),
        '백업 불필요성이 명시되어야 합니다.'
      );
    });

    it('24x7 모니터링·법률 최신성 자동 보장 주장이 금지되어야 한다 (특별 안전조건)', () => {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      assert.ok(
        content.includes('24x7') && content.includes('금지') || content.includes('주장하지 않습니다'),
        '24x7 실시간/자동 보장 주장 금지 안전조건이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 운영비 장부 템플릿 검증 (docs/COST_LEDGER_TEMPLATE.csv)', () => {
    const ledgerPath = path.resolve('docs/COST_LEDGER_TEMPLATE.csv');

    it('docs/COST_LEDGER_TEMPLATE.csv 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(ledgerPath), 'docs/COST_LEDGER_TEMPLATE.csv 파일이 존재해야 합니다.');
    });

    it('CSV 헤더에 예상 비용과 실제 비용 컬럼이 구분되어 있어야 한다', () => {
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      assert.ok(content.includes('projected_cost_krw'), 'projected_cost_krw 컬럼이 존재해야 합니다.');
      assert.ok(content.includes('actual_cost_krw'), 'actual_cost_krw 컬럼이 존재해야 합니다.');
      assert.ok(content.includes('cost_variance_krw'), 'cost_variance_krw 컬럼이 존재해야 합니다.');
    });

    it('모든 운영비 항목이 0원($0)으로 무료 티어 내 무과금 운영임이 입증되어야 한다', () => {
      const content = fs.readFileSync(ledgerPath, 'utf-8');
      const lines = content.trim().split('\n').slice(1);
      assert.ok(lines.length >= 6, '최소 6개 이상의 운영비 행이 존재해야 합니다.');

      for (const line of lines) {
        const parts = line.split(',');
        const projected = parts[4];
        const actual = parts[5];
        assert.strictEqual(projected, '0', `예상 비용은 0원이어야 합니다: ${line}`);
        assert.strictEqual(actual, '0', `실제 비용은 0원이어야 합니다: ${line}`);
      }
    });
  });
});
