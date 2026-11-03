/**
 * ReturnWise CI Quality Gate Contract Tests (tests/e2e/ci.spec.ts)
 * Verifies .github/workflows/ci.yml workflow syntax, event triggers,
 * minimal permissions, concurrency control, mandatory quality steps,
 * and artifact archival policies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T24 | CI Quality Gate & G3 Certification Contract', () => {
  const workflowPath = path.resolve('.github/workflows/ci.yml');

  it('.github/workflows/ci.yml 파일이 존재해야 한다', () => {
    assert.ok(fs.existsSync(workflowPath), '.github/workflows/ci.yml 파일이 존재해야 합니다.');
  });

  it('워크플로가 main 브랜치에 대한 push 및 pull_request 이벤트를 트리거해야 한다', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('push:'), 'push 이벤트가 선언되어야 합니다.');
    assert.ok(content.includes('pull_request:'), 'pull_request 이벤트가 선언되어야 합니다.');
    assert.ok(content.includes('branches: [main]') || content.includes('- main'), 'main 브랜치가 타깃이어야 합니다.');
  });

  it('최소 권한 원칙(Principle of Least Privilege)에 따라 contents: read 권한만 부여되어야 한다', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('permissions:'), 'permissions 블록이 명시되어야 합니다.');
    assert.ok(content.includes('contents: read'), 'contents: read 최소 권한이 선언되어야 합니다.');
    assert.ok(!content.includes('write-all'), '과도한 write-all 권한이 없어야 합니다.');
  });

  it('중복 실행을 방지하고 리소스를 절약하는 concurrency(cancel-in-progress)가 선언되어야 한다', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('concurrency:'), 'concurrency 블록이 선언되어야 합니다.');
    assert.ok(content.includes('cancel-in-progress: true'), 'cancel-in-progress: true가 활성화되어야 합니다.');
  });

  it('CI 파이프라인 5대 핵심 관문(typecheck, lint, build, test, audit)이 순차 실행되어야 한다', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('npm run typecheck'), 'TypeScript 검증 스텝이 포함되어야 합니다.');
    assert.ok(content.includes('npm run lint'), 'ESLint 코드 품질 스텝이 포함되어야 합니다.');
    assert.ok(content.includes('npm run build'), '프로덕션 빌드 스텝이 포함되어야 합니다.');
    assert.ok(content.includes('npm test'), '자동화 테스트 스위트 실행 스텝이 포함되어야 합니다.');
    assert.ok(content.includes('npm audit --audit-level=high'), '보안 취약점 감사 스텝이 포함되어야 합니다.');
  });

  it('성공 시 dist/ 빌드 결과물을 아티팩트로 업로드해야 한다', () => {
    const content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.includes('actions/upload-artifact@v4'), 'upload-artifact 액션이 사용되어야 합니다.');
    assert.ok(content.includes('path: dist/'), 'dist/ 디렉터리가 업로드 경로여야 합니다.');
  });
});
