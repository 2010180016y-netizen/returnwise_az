/**
 * ReturnWise SEO, Performance & Content Indexing Contract Tests (tests/e2e/seo.spec.ts)
 * Verifies title, description, canonical, robots.txt, sitemap.xml, Schema.org JSON-LD,
 * Open Graph, Twitter Cards, semantic HTML, and zero programmatic spam page rules.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 페이지 자동 대량 생성 금지 (단일 정규 URL 중심, 스팸성 프로그래매틱 SEO 금지).
 * 2. 검색엔진 허위 구조화데이터(가짜 리뷰, 조작된 평점) 일체 금지.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T22 | SEO, Performance & Content Indexing Contract', () => {
  describe('1. HTML 메타 태그 및 시맨틱 헤더 검증 (index.html & dist/index.html)', () => {
    it('html 태그에 lang="ko"가 선언되어 있어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      assert.ok(/<html[^>]+lang=["']ko["']/i.test(html), 'html 태그에 lang="ko"가 설정되어야 합니다.');
    });

    it('title 태그에 서비스명과 2026 전자상거래법 키워드가 명시되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      assert.ok(titleMatch, 'title 태그가 존재해야 합니다.');
      const title = titleMatch[1];
      assert.ok(title.includes('ReturnWise'), 'title에 ReturnWise가 포함되어야 합니다.');
      assert.ok(title.includes('반품'), 'title에 핵심 키워드(반품)가 포함되어야 합니다.');
      assert.ok(title.includes('2026 전자상거래법'), 'title에 2026 전자상거래법이 포함되어야 합니다.');
    });

    it('meta description이 존재하고 적정 길이(80~200자)의 설명적 문구를 가져야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
      assert.ok(descMatch, 'meta description이 존재해야 합니다.');
      const desc = descMatch[1];
      assert.ok(desc.length >= 80 && desc.length <= 200, `meta description 길이(${desc.length}자)가 적정해야 합니다.`);
      assert.ok(desc.includes('반품'), 'description에 반품 키워드가 포함되어야 합니다.');
      assert.ok(desc.includes('전자상거래법'), 'description에 전자상거래법 키워드가 포함되어야 합니다.');
      assert.ok(desc.includes('로컬 연산'), 'description에 프라이버시(로컬 연산)가 명시되어야 합니다.');
    });

    it('canonical 태그가 올바른 정규 URL(https://returnwise.pages.dev/)을 가리켜야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      assert.ok(canonicalMatch, 'canonical 태그가 존재해야 합니다.');
      assert.strictEqual(
        canonicalMatch[1],
        'https://returnwise.pages.dev/',
        'canonical URL이 정규 배포 도메인을 가리켜야 합니다.'
      );
    });

    it('favicon svg 링크 및 테마 색상, robots 메타 태그가 정상 선언되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      assert.ok(html.includes('href="/favicon.svg"'), 'favicon.svg 링크가 포함되어야 합니다.');
      assert.ok(html.includes('name="theme-color"'), 'theme-color 메타 태그가 선언되어야 합니다.');
      assert.ok(html.includes('content="index, follow"'), 'robots index, follow가 선언되어야 합니다.');
    });
  });

  describe('2. Open Graph & Twitter Card 소셜 메타 태그 검증', () => {
    it('Open Graph 필수 태그 8종(type, locale, site_name, title, description, url, image, alt)이 정의되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      assert.ok(html.includes('property="og:type" content="website"'));
      assert.ok(html.includes('property="og:locale" content="ko_KR"'));
      assert.ok(html.includes('property="og:site_name" content="ReturnWise"'));
      assert.ok(html.includes('property="og:title"'));
      assert.ok(html.includes('property="og:description"'));
      assert.ok(html.includes('property="og:url" content="https://returnwise.pages.dev/"'));
      assert.ok(html.includes('property="og:image"'));
      assert.ok(html.includes('property="og:image:alt"'));
    });

    it('Twitter Card 태그 4종(card, title, description, image)이 정의되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
      assert.ok(html.includes('name="twitter:title"'));
      assert.ok(html.includes('name="twitter:description"'));
      assert.ok(html.includes('name="twitter:image"'));
    });
  });

  describe('3. Schema.org 구조화 데이터 및 허위 정보 금지 검증 (WebApplication & FAQPage)', () => {
    it('WebApplication JSON-LD 스키마가 유효하고 무료(KRW 0원) 서비스임이 선언되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const ldJsonMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
      assert.ok(ldJsonMatches.length >= 2, '최소 2개 이상의 JSON-LD 스크립트가 존재해야 합니다.');

      let webAppFound = false;
      for (const match of ldJsonMatches) {
        const json = JSON.parse(match[1]);
        if (json['@type'] === 'WebApplication') {
          webAppFound = true;
          assert.strictEqual(json.name, 'ReturnWise');
          assert.strictEqual(json.applicationCategory, 'BusinessApplication');
          assert.strictEqual(json.inLanguage, 'ko');
          assert.strictEqual(json.offers.price, '0');
          assert.strictEqual(json.offers.priceCurrency, 'KRW');
        }
      }
      assert.ok(webAppFound, 'WebApplication 스키마가 발견되어야 합니다.');
    });

    it('FAQPage JSON-LD 스키마가 유효하고 법령에 기반한 진실한 질의응답을 포함해야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const ldJsonMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];

      let faqFound = false;
      for (const match of ldJsonMatches) {
        const json = JSON.parse(match[1]);
        if (json['@type'] === 'FAQPage') {
          faqFound = true;
          assert.ok(Array.isArray(json.mainEntity), 'mainEntity 배열이 존재해야 합니다.');
          assert.ok(json.mainEntity.length >= 4, '최소 4개 이상의 FAQ 문항이 포함되어야 합니다.');

          // 허위 리뷰, 가짜 별점 평점(aggregateRating)이 없어야 함 (특별 안전조건)
          assert.strictEqual(json.aggregateRating, undefined, '허위 별점/리뷰 스키마가 없어야 합니다.');
        }
      }
      assert.ok(faqFound, 'FAQPage 스키마가 발견되어야 합니다.');
    });
  });

  describe('4. 크롤러용 정적 마크업 및 noscript 색인 보장 (Static Indexing Fallback)', () => {
    it('noscript 태그 내에 H1, H2, 4대 대안, 전자상거래법 요약 정적 콘텐츠가 포함되어야 한다', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
      const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/i);
      assert.ok(noscriptMatch, 'noscript 블록이 존재해야 합니다.');

      const noscriptContent = noscriptMatch[1];
      assert.ok(noscriptContent.includes('<h1>ReturnWise'), 'noscript 내 H1 태그가 존재해야 합니다.');
      assert.ok(noscriptContent.includes('제18조 제9항'), '전자상거래법 제18조 제9항 안내가 포함되어야 합니다.');
      assert.ok(noscriptContent.includes('부분환불 3대 요건'), '부분환불 가이드가 포함되어야 합니다.');
      assert.ok(noscriptContent.includes('100% 브라우저 로컬 연산'), '프라이버시 원칙이 포함되어야 합니다.');
    });
  });

  describe('5. robots.txt, sitemap.xml & favicon 검증', () => {
    it('public/robots.txt 파일이 전체 크롤링 허용 및 sitemap 경로를 명시해야 한다', () => {
      const robotsPath = path.resolve('public/robots.txt');
      assert.ok(fs.existsSync(robotsPath), 'public/robots.txt가 존재해야 합니다.');

      const content = fs.readFileSync(robotsPath, 'utf-8');
      assert.ok(content.includes('User-agent: *'), 'User-agent: * 규칙이 포함되어야 합니다.');
      assert.ok(content.includes('Allow: /'), 'Allow: / 규칙이 포함되어야 합니다.');
      assert.ok(
        content.includes('Sitemap: https://returnwise.pages.dev/sitemap.xml'),
        'Sitemap URL이 명시되어야 합니다.'
      );
    });

    it('public/sitemap.xml 파일이 유효한 XML이고 정규 URL을 포함해야 한다', () => {
      const sitemapPath = path.resolve('public/sitemap.xml');
      assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml이 존재해야 합니다.');

      const content = fs.readFileSync(sitemapPath, 'utf-8');
      assert.ok(content.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'XML 선언이 포함되어야 합니다.');
      assert.ok(
        content.includes('<loc>https://returnwise.pages.dev/</loc>'),
        '정규 페이지 loc이 포함되어야 합니다.'
      );
    });

    it('public/favicon.svg 파일이 존재하고 유효한 SVG 규격을 가져야 한다', () => {
      const faviconPath = path.resolve('public/favicon.svg');
      assert.ok(fs.existsSync(faviconPath), 'public/favicon.svg가 존재해야 합니다.');

      const content = fs.readFileSync(faviconPath, 'utf-8');
      assert.ok(content.includes('<svg') && content.includes('</svg>'), '유효한 SVG 마크업이어야 합니다.');
    });
  });

  describe('6. 특별 안전조건: 페이지 자동 대량 생성 금지 (Zero Programmatic Spam)', () => {
    it('sitemap.xml에는 단일 정규 URL 1개만 등록되어 있고 스팸성 자동 생성 URL이 0건이어야 한다', () => {
      const content = fs.readFileSync(path.resolve('public/sitemap.xml'), 'utf-8');
      const urlMatches = [...content.matchAll(/<url>/g)];
      assert.strictEqual(
        urlMatches.length,
        1,
        'sitemap.xml에는 오직 1개의 정규 URL만 등록되어야 합니다 (스팸성 대량 생성 금지).'
      );
    });
  });

  describe('7. 번들 및 에셋 최적화 검증 (Bundle Optimization)', () => {
    it('프로덕션 번들 자바스크립트 크기가 300KB 이하로 가볍고 신속해야 한다', () => {
      const bundlePath = path.resolve('dist/assets/index.js');
      assert.ok(fs.existsSync(bundlePath), 'dist/assets/index.js 파일이 존재해야 합니다.');

      const stat = fs.statSync(bundlePath);
      const sizeKb = Math.round(stat.size / 1024);
      assert.ok(
        sizeKb <= 300,
        `프로덕션 번들 크기(${sizeKb}KB)가 300KB 이하여야 합니다 (실측: ${sizeKb}KB).`
      );
    });

    it('빌드 시 index.html, robots.txt, sitemap.xml, favicon.svg가 dist로 전원 복사되어야 한다', () => {
      assert.ok(fs.existsSync(path.resolve('dist/index.html')), 'dist/index.html 복사 완료');
      assert.ok(fs.existsSync(path.resolve('dist/robots.txt')), 'dist/robots.txt 복사 완료');
      assert.ok(fs.existsSync(path.resolve('dist/sitemap.xml')), 'dist/sitemap.xml 복사 완료');
      assert.ok(fs.existsSync(path.resolve('dist/favicon.svg')), 'dist/favicon.svg 복사 완료');
    });
  });
});
