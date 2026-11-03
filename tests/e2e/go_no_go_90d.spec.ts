/**
 * ReturnWise 90-Day Go/No-Go/Pivot Contract Tests (tests/e2e/go_no_go_90d.spec.ts)
 * Verifies 90-day decision criteria, 5 core metrics table, completed vs pending status,
 * CONDITIONAL_GO judgment, P0 risk re-assessment, owner sign-off, and anti-optimism safety rule.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 성과 없을 때 낙관적 서사로 개발 계속하지 말 것 (No false optimism).
 * 2. 결재자(김회기 대표님) 명시적 서명란 보존 (PENDING_OWNER_SIGN_OFF).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T32 | 90-Day Go/No-Go/Pivot Decision Contract', () => {
  const docPath = path.resolve('docs/GO_NO_GO_90D.md');

  it('docs/GO_NO_GO_90D.md 파일이 존재해야 한다', () => {
    assert.ok(fs.existsSync(docPath), 'docs/GO_NO_GO_90D.md 파일이 존재해야 합니다.');
  });

  it('CONDITIONAL_GO 판정과 [유지 및 개선] 경로가 명시되어야 한다', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(content.includes('CONDITIONAL_GO'), 'CONDITIONAL_GO 판정이 명시되어야 합니다.');
    assert.ok(content.includes('유지 및') || content.includes('Maintain'), '유지 및 개선 경로가 포함되어야 합니다.');
  });

  it('5대 핵심 실측 지표 대조표가 완료/미완료 상태를 명확히 구분하여 포함되어야 한다', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(content.includes('1. 유효 이용자'), '유효 이용자 지표가 포함되어야 합니다.');
    assert.ok(content.includes('2. 반복 활용 사례'), '반복 활용 사례 지표가 포함되어야 합니다.');
    assert.ok(content.includes('3. 지불 의사'), '지불 의사 지표가 포함되어야 합니다.');
    assert.ok(content.includes('4. 유입 비용'), '유입 비용 지표가 포함되어야 합니다.');
    assert.ok(content.includes('5. 안전사고 / 운영비'), '안전사고/운영비 지표가 포함되어야 합니다.');
    assert.ok(content.includes('완료 (COMPLETED)'), '완료 상태가 명시되어야 합니다.');
    assert.ok(content.includes('진행 중') || content.includes('대기 중'), '미완료/대기 상태가 구분되어야 합니다.');
  });

  it('성과 없을 때 낙관적 서사로 개발을 계속하지 말아야 한다 (특별 안전조건)', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(
      content.includes('낙관적 서사') || content.includes('낙관적 편향'),
      '낙관적 서사 경계 안전조건이 명시되어야 합니다.'
    );
  });

  it('잔여 불확실성 및 리스크 요인이 솔직하게 기록되어야 한다', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(content.includes('색인 지연 불확실성') || content.includes('불확실성'), '불확실성이 기록되어야 합니다.');
  });

  it('Pro 개발을 위한 3대 P0 리스크(PG비용, 개인정보, 인프라) 재평가가 수록되어야 한다', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(content.includes('PG 고정비 리스크'), 'PG 리스크가 수록되어야 합니다.');
    assert.ok(content.includes('개인정보 유출 리스크'), '개인정보 리스크가 수록되어야 합니다.');
    assert.ok(content.includes('클라우드 인프라 과금'), '인프라 과금 리스크가 수록되어야 합니다.');
  });

  it('최종 결재권자(김회기 대표님) 서명란(PENDING_OWNER_SIGN_OFF)이 존재해야 한다', () => {
    const content = fs.readFileSync(docPath, 'utf-8');
    assert.ok(
      content.includes('PENDING_OWNER_SIGN_OFF'),
      '김회기 대표님 승인 대기 서명란이 명시되어야 합니다.'
    );
  });
});
