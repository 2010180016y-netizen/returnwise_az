/**
 * ReturnWise Cloudflare Pages Preview & Staging Contract Tests (tests/e2e/pages_preview.spec.ts)
 * Verifies dist output directory, 404 page, _redirects rules, zero env variables,
 * CSP headers alignment, and staging isolation.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. Cloudflare 연결 및 원격 작업은 명시 승인 전 실행 금지 (Local Verification First).
 * 2. 프리뷰 환경 변경이 프로덕션 설정에 악영향을 주지 않아야 함.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T25 | Cloudflare Pages Preview & Staging Contract', () => {
  describe('1. 배포 명세서 및 빌드 규격 검증 (docs/PAGES_DEPLOYMENT.md)', () => {
    const docPath = path.resolve('docs/PAGES_DEPLOYMENT.md');

    it('docs/PAGES_DEPLOYMENT.md 파일이 존재해야 한다', () => {
      assert.ok(fs.existsSync(docPath), 'docs/PAGES_DEPLOYMENT.md 파일이 존재해야 합니다.');
    });

    it('배포 설정(Project Name, Build Command, Output Dir: dist)이 명시되어야 한다', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      assert.ok(content.includes('npm run build'), '빌드 명령이 npm run build여야 합니다.');
      assert.ok(content.includes('dist'), '출력 디렉터리가 dist여야 합니다.');
      assert.ok(content.includes('returnwise'), '프로젝트명이 명시되어야 합니다.');
    });

    it('환경변수 0건 원칙(Zero Environment Variables)이 명시되어야 한다', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      assert.ok(
        content.includes('환경변수 0건') || content.includes('Zero Environment Variables'),
        '환경변수 0건 원칙이 명시되어야 합니다.'
      );
    });

    it('특별 안전조건: 명시적 승인 전 임의 원격 작업 금지 가이드가 포함되어야 한다', () => {
      const content = fs.readFileSync(docPath, 'utf-8');
      assert.ok(
        content.includes('특별 안전조건') || content.includes('명시 승인 전 실행 금지'),
        '특별 안전조건이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 정적 에셋 및 프리뷰 라우팅 아티팩트 검증 (dist/)', () => {
    it('dist 디렉터리에 index.html과 번들 에셋이 완비되어 있어야 한다', () => {
      assert.ok(fs.existsSync(path.resolve('dist/index.html')), 'dist/index.html이 존재해야 합니다.');
      assert.ok(fs.existsSync(path.resolve('dist/assets/index.js')), 'dist/assets/index.js가 존재해야 합니다.');
      assert.ok(fs.existsSync(path.resolve('dist/assets/index.css')), 'dist/assets/index.css가 존재해야 합니다.');
    });

    it('커스텀 404 페이지(dist/404.html)가 존재하고 noindex 태그를 가져야 한다', () => {
      const notFoundPath = path.resolve('dist/404.html');
      assert.ok(fs.existsSync(notFoundPath), 'dist/404.html이 존재해야 합니다.');

      const content = fs.readFileSync(notFoundPath, 'utf-8');
      assert.ok(content.includes('404'), '404 안내 문구가 포함되어야 합니다.');
      assert.ok(content.includes('noindex'), '404 페이지는 noindex여야 합니다.');
      assert.ok(content.includes('계산기 메인으로 이동'), '메인 복귀 링크가 포함되어야 합니다.');
    });

    it('별칭 리다이렉트 규칙(dist/_redirects)이 유효하게 등록되어야 한다', () => {
      const redirectsPath = path.resolve('dist/_redirects');
      assert.ok(fs.existsSync(redirectsPath), 'dist/_redirects 파일이 존재해야 합니다.');

      const content = fs.readFileSync(redirectsPath, 'utf-8');
      assert.ok(content.includes('/calculator / 301'), '/calculator 301 리다이렉트 규칙이 포함되어야 합니다.');
      assert.ok(content.includes('/return / 301'), '/return 301 리다이렉트 규칙이 포함되어야 합니다.');
    });

    it('dist/_headers에 404 전용 noindex 헤더와 루트 보안 헤더가 통합되어 있어야 한다', () => {
      const headersPath = path.resolve('dist/_headers');
      assert.ok(fs.existsSync(headersPath), 'dist/_headers 파일이 존재해야 합니다.');

      const content = fs.readFileSync(headersPath, 'utf-8');
      assert.ok(content.includes('X-Content-Type-Options: nosniff'), '보안 헤더 포함 확인');
      assert.ok(content.includes('connect-src \'none\''), '외부 통신 차단 CSP 확인');
      assert.ok(content.includes('/404.html'), '404 전용 헤더 블록 확인');
      assert.ok(content.includes('X-Robots-Tag: noindex, nofollow'), '404 색인 차단 확인');
    });
  });

  describe('3. 환경변수 및 비밀값 제로(Zero Secrets) 검증', () => {
    it('.env 파일이 존재하지 않거나 비밀키가 없어야 한다', () => {
      const envPath = path.resolve('.env');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        assert.ok(!content.includes('KEY='), '.env에 기밀 키가 없어야 합니다.');
      } else {
        assert.ok(true, '.env 파일이 부재함 (Zero Environment Variables 충족)');
      }
    });
  });
});
