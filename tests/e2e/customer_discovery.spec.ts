/**
 * ReturnWise Customer Discovery & Usability Testing Contract Tests (tests/e2e/customer_discovery.spec.ts)
 * Verifies interview scripts, No-PII participant log template, 5 repeat use cases,
 * problem coding, top 5 improvement priorities, and INTERVIEW_PENDING truthfulness.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 고객의 실명/연락처 저장은 별도 동의·보호체계 없이 금지 (No-PII).
 * 2. 추정 인터뷰 인용 금지 (INTERVIEW_PENDING 명시).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T29 | Customer Discovery & Usability Contract', () => {
  describe('1. 인터뷰 기획 및 프로토콜 검증 (docs/CUSTOMER_DISCOVERY.md)', () => {
    const discoveryPath = path.resolve('docs/CUSTOMER_DISCOVERY.md');

    it('docs/CUSTOMER_DISCOVERY.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(discoveryPath), 'docs/CUSTOMER_DISCOVERY.md 파일이 존재해야 합니다.');
    });

    it('인터뷰 진행 상태가 INTERVIEW_PENDING으로 명시되어야 한다 (추정 날조 금지)', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(
        content.includes('INTERVIEW_PENDING'),
        '인터뷰 상태가 INTERVIEW_PENDING으로 정직하게 명시되어야 합니다.'
      );
      assert.ok(
        content.includes('추정 인터뷰 인용 금지'),
        '추정 인터뷰 인용 금지 원칙이 수록되어야 합니다.'
      );
    });

    it('15~20인 표준 인터뷰 스크립트 5단계가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(content.includes('Phase 1'), 'Phase 1 스토어 프로필이 포함되어야 합니다.');
      assert.ok(content.includes('Phase 2'), 'Phase 2 현재 대안이 포함되어야 합니다.');
      assert.ok(content.includes('Phase 3'), 'Phase 3 핵심 고통도가 포함되어야 합니다.');
      assert.ok(content.includes('Phase 4'), 'Phase 4 핸즈온 실습이 포함되어야 합니다.');
      assert.ok(content.includes('Phase 5'), 'Phase 5 시간 절감 및 재방문 의사가 포함되어야 합니다.');
    });

    it('5회 이상 구체적 반복 이용 사례가 분석되어 있어야 한다', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(content.includes('Case 1'), '반복 사례 1이 수록되어야 합니다.');
      assert.ok(content.includes('Case 2'), '반복 사례 2가 수록되어야 합니다.');
      assert.ok(content.includes('Case 3'), '반복 사례 3이 수록되어야 합니다.');
      assert.ok(content.includes('Case 4'), '반복 사례 4가 수록되어야 합니다.');
      assert.ok(content.includes('Case 5'), '반복 사례 5가 수록되어야 합니다.');
    });

    it('정성정보 문제별 코딩 체계(PR-01 ~ PR-05)가 정의되어 있어야 한다', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(content.includes('PR-01'), 'PR-01 코드가 정의되어야 합니다.');
      assert.ok(content.includes('PR-02'), 'PR-02 코드가 정의되어야 합니다.');
      assert.ok(content.includes('PR-03'), 'PR-03 코드가 정의되어야 합니다.');
      assert.ok(content.includes('PR-04'), 'PR-04 코드가 정의되어야 합니다.');
      assert.ok(content.includes('PR-05'), 'PR-05 코드가 정의되어야 합니다.');
    });

    it('개선 우선순위 상위 5개가 도출되어 있어야 한다', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(content.includes('1위') && content.includes('수수료율'), '1위 우선순위가 명시되어야 합니다.');
      assert.ok(content.includes('2위') && content.includes('소비자 응대'), '2위 우선순위가 명시되어야 합니다.');
      assert.ok(content.includes('3위') && content.includes('대량 반품'), '3위 우선순위가 명시되어야 합니다.');
      assert.ok(content.includes('4위') && content.includes('3PL'), '4위 우선순위가 명시되어야 합니다.');
      assert.ok(content.includes('5위') && content.includes('모바일 PWA'), '5위 우선순위가 명시되어야 합니다.');
    });

    it('개인정보(실명/연락처) 저장 금지 안전조건이 명시되어야 한다', () => {
      const content = fs.readFileSync(discoveryPath, 'utf-8');
      assert.ok(
        content.includes('No-PII') || content.includes('실명') && content.includes('금지'),
        '개인정보 수집 및 저장 금지 안전조건이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 참여자 기록 양식 검증 (docs/INTERVIEW_LOG_TEMPLATE.csv)', () => {
    const logPath = path.resolve('docs/INTERVIEW_LOG_TEMPLATE.csv');

    it('docs/INTERVIEW_LOG_TEMPLATE.csv 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(logPath), 'docs/INTERVIEW_LOG_TEMPLATE.csv 파일이 존재해야 합니다.');
    });

    it('CSV 헤더에 실명/전화번호/이메일 등 PII 컬럼이 없어야 한다', () => {
      const content = fs.readFileSync(logPath, 'utf-8');
      const header = content.trim().split('\n')[0];
      assert.ok(!header.includes('name'), '헤더에 name이 포함되어서는 안 됩니다.');
      assert.ok(!header.includes('phone'), '헤더에 phone이 포함되어서는 안 됩니다.');
      assert.ok(!header.includes('email'), '헤더에 email이 포함되어서는 안 됩니다.');
      assert.ok(header.includes('participant_id'), '익명 participant_id 컬럼이 있어야 합니다.');
      assert.ok(header.includes('problem_code'), 'problem_code 컬럼이 있어야 합니다.');
    });

    it('최소 15명 이상의 참여자 슬롯(P01~P20)이 준비되어 있어야 한다', () => {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').slice(1);
      assert.ok(lines.length >= 15, `참여자 슬롯은 15개 이상이어야 합니다. 현재: ${lines.length}`);
      assert.ok(lines.some((l) => l.startsWith('P01')), 'P01 슬롯이 존재해야 합니다.');
      assert.ok(lines.some((l) => l.startsWith('P20')), 'P20 슬롯이 존재해야 합니다.');
    });

    it('모든 행의 초기 상태가 INTERVIEW_PENDING이어야 한다', () => {
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').slice(1);
      for (const line of lines) {
        assert.ok(
          line.includes('INTERVIEW_PENDING'),
          `행의 상태가 INTERVIEW_PENDING이어야 합니다: ${line}`
        );
      }
    });
  });
});
