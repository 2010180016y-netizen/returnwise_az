/**
 * ReturnWise Production Release & Domain Contract Tests (tests/e2e/prod_release.spec.ts)
 * Verifies production release dossier, rollback points, dist artifact completeness,
 * canonical domain settings, and strict safety guidelines.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T27 | Production Release & Domain Indexing Contract', () => {
  describe('1. 프로덕션 릴리스 보고서 검증 (docs/implementation/PROD_RELEASE.md)', () => {
    const releaseDocPath = path.resolve('docs/implementation/PROD_RELEASE.md');

    it('docs/implementation/PROD_RELEASE.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(releaseDocPath), 'PROD_RELEASE.md 파일이 존재해야 합니다.');
    });

    it('릴리스 버전 v0.1.0, 공개 일자 및 승인자(김회기)가 명시되어야 한다', () => {
      const content = fs.readFileSync(releaseDocPath, 'utf-8');
      assert.ok(content.includes('v0.1.0'), '릴리스 버전 v0.1.0이 명시되어야 합니다.');
      assert.ok(content.includes('2026-11-03'), '공개 일자가 2026-11-03이어야 합니다.');
      assert.ok(content.includes('김회기'), '승인자(김회기)가 명시되어야 합니다.');
    });

    it('정규 캐노니컬 URL(https://returnwise.pages.dev/)과 HTTPS 규격이 명시되어야 한다', () => {
      const content = fs.readFileSync(releaseDocPath, 'utf-8');
      assert.ok(
        content.includes('https://returnwise.pages.dev/'),
        '캐노니컬 URL이 명시되어야 합니다.'
      );
      assert.ok(content.includes('HTTPS') || content.includes('TLS'), 'HTTPS 보안 규격이 명시되어야 합니다.');
    });

    it('프로덕션 스모크 테스트 증빙과 Search Console 가이드가 포함되어야 한다', () => {
      const content = fs.readFileSync(releaseDocPath, 'utf-8');
      assert.ok(
        content.includes('스모크 테스트') || content.includes('Smoke Test'),
        '스모크 테스트 증빙이 포함되어야 합니다.'
      );
      assert.ok(
        content.includes('Search Console') || content.includes('서치어드바이저'),
        'Search Console 연동 가이드가 포함되어야 합니다.'
      );
    });
  });

  describe('2. 롤백 지점 및 복구 매뉴얼 검증 (docs/ROLLBACK_POINT.md)', () => {
    const rollbackDocPath = path.resolve('docs/ROLLBACK_POINT.md');

    it('docs/ROLLBACK_POINT.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(rollbackDocPath), 'ROLLBACK_POINT.md 파일이 존재해야 합니다.');
    });

    it('초기 베이스라인 커밋 SHA가 명시되어야 한다', () => {
      const content = fs.readFileSync(rollbackDocPath, 'utf-8');
      assert.ok(
        content.includes('f812c4e9fa6ae0c08b8420ad611052a2b970bcd2'),
        '베이스라인 커밋 SHA가 명시되어야 합니다.'
      );
    });

    it('Cloudflare Pages 및 Git 롤백 절차가 구체적으로 기술되어야 한다', () => {
      const content = fs.readFileSync(rollbackDocPath, 'utf-8');
      assert.ok(content.includes('Cloudflare Dashboard'), 'Cloudflare 대시보드 롤백 절차가 명시되어야 합니다.');
      assert.ok(content.includes('git revert') || content.includes('git reset'), 'Git 롤백 명령이 명시되어야 합니다.');
    });
  });

  describe('3. 프로덕션 배포 번들(dist/) 완비성 검증', () => {
    const requiredFiles = [
      'dist/index.html',
      'dist/assets/index.js',
      'dist/assets/index.css',
      'dist/_headers',
      'dist/_redirects',
      'dist/404.html',
      'dist/robots.txt',
      'dist/sitemap.xml',
      'dist/favicon.svg',
    ];

    for (const file of requiredFiles) {
      it(`필수 배포 아티팩트 ${file}이 존재해야 한다`, () => {
        assert.ok(fs.existsSync(path.resolve(file)), `${file} 파일이 존재해야 합니다.`);
      });
    }
  });
});
