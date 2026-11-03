/**
 * ReturnWise Security, Privacy & Dependency Audit Contract Tests (tests/e2e/privacy.spec.ts)
 * Verifies CSP/HTTP security headers, zero outbound network communication, No-PII,
 * zero third-party analytics/scripts, source map policies, and privacy disclosures.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 민감값을 포함한 서드파티 analytics 자동 도입 금지.
 * 2. High/Critical 알려진 취약점 0건 유지.
 * 3. 사용자 입력값 및 금융 산식의 외부 전송 0건 강제.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../../src/app/App';
import {
  saveDefaults,
  clearSavedDefaults,
  sanitizeDefaults,
} from '../../src/lib/storage';
import {
  PRIVACY_POLICY_SUMMARY,
  LEGAL_DISCLAIMER_TEXT,
  OPERATOR_DISCLOSURE,
} from '../../src/content/disclosures';

describe('T21 | Security, Privacy & Dependency Audit Contract', () => {
  describe('1. CSP & HTTP Response Security Headers (public/_headers & dist/_headers)', () => {
    it('public/_headers 파일이 존재하고 필수 보안 헤더 7종을 모두 선언해야 한다', () => {
      const headersPath = path.resolve('public/_headers');
      assert.ok(fs.existsSync(headersPath), 'public/_headers 파일이 존재해야 합니다.');

      const headersContent = fs.readFileSync(headersPath, 'utf-8');

      // X-Content-Type-Options
      assert.ok(
        headersContent.includes('X-Content-Type-Options: nosniff'),
        'MIME 스니핑 방지(nosniff) 헤더가 선언되어야 합니다.'
      );

      // X-Frame-Options
      assert.ok(
        headersContent.includes('X-Frame-Options: DENY'),
        'Clickjacking 방지(DENY) 헤더가 선언되어야 합니다.'
      );

      // Referrer-Policy
      assert.ok(
        headersContent.includes('Referrer-Policy: strict-origin-when-cross-origin'),
        '엄격한 리퍼러 정책이 선언되어야 합니다.'
      );

      // Permissions-Policy (민감 디바이스 API 차단)
      assert.ok(
        headersContent.includes('Permissions-Policy:'),
        'Permissions-Policy 헤더가 선언되어야 합니다.'
      );
      assert.ok(
        headersContent.includes('camera=()') &&
          headersContent.includes('microphone=()') &&
          headersContent.includes('geolocation=()'),
        '카메라, 마이크, 위치정보 등 디바이스 API가 차단되어야 합니다.'
      );

      // Strict-Transport-Security (HSTS)
      assert.ok(
        headersContent.includes('Strict-Transport-Security: max-age=31536000'),
        'HSTS(1년 이상) 헤더가 선언되어야 합니다.'
      );

      // Cross-Origin Isolation
      assert.ok(
        headersContent.includes('Cross-Origin-Opener-Policy: same-origin') &&
          headersContent.includes('Cross-Origin-Resource-Policy: same-origin'),
        'COOP 및 CORP 헤더가 same-origin으로 설정되어야 합니다.'
      );
    });

    it("Content-Security-Policy는 connect-src 'none' 및 object-src 'none'으로 외부 유출을 원천 차단해야 한다", () => {
      const headersContent = fs.readFileSync(path.resolve('public/_headers'), 'utf-8');

      assert.ok(headersContent.includes('Content-Security-Policy:'), 'CSP 헤더가 선언되어야 합니다.');

      // connect-src 'none'은 브라우저 수준에서 fetch, XHR, WebSocket을 100% 차단
      assert.ok(
        headersContent.includes("connect-src 'none'"),
        "CSP에 connect-src 'none'이 명시되어 외부 네트워크 전송이 원천 차단되어야 합니다."
      );

      // object-src 'none' 및 frame-ancestors 'none'
      assert.ok(
        headersContent.includes("object-src 'none'") &&
          headersContent.includes("frame-ancestors 'none'"),
        "플러그인 및 iframe 임베딩이 CSP로 원천 차단되어야 합니다."
      );
    });

    it('빌드 시 public/_headers가 dist/_headers로 정상 복사되어야 한다', () => {
      const distHeadersPath = path.resolve('dist/_headers');
      assert.ok(
        fs.existsSync(distHeadersPath),
        'dist/_headers 파일이 프로덕션 빌드 결과물에 포함되어야 합니다.'
      );
    });
  });

  describe('2. 입력값 외부 전송 및 서드파티 스크립트 점검 (Zero Outbound Network)', () => {
    it('index.html에 서드파티 트래커나 외부 스크립트가 일체 포함되지 않아야 한다 (특별 안전조건)', () => {
      const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');

      // 구글 애널리틱스, 태그매니저, 페이스북 픽셀, 핫자 등 추적 스크립트 금지
      const forbiddenTrackers = [
        'google-analytics.com',
        'googletagmanager.com',
        'gtag',
        'facebook.net',
        'fbevents.js',
        'hotjar',
        'mixpanel',
        'amplitude',
        'segment.io',
      ];

      for (const tracker of forbiddenTrackers) {
        assert.ok(
          !html.toLowerCase().includes(tracker),
          `index.html에 서드파티 트래커(${tracker})가 포함되어서는 안 됩니다.`
        );
      }

      // 외부 CDN 스크립트 로드 금지 (<script src="https://...")
      assert.ok(
        !/<script[^>]+src=["']https?:\/\//i.test(html),
        'index.html에 외부 도메인 스크립트 태그가 포함되어서는 안 됩니다.'
      );
    });

    it('소스코드(src/) 전체에 fetch, XMLHttpRequest, sendBeacon, WebSocket 호출이 0건이어야 한다', () => {
      function scanDir(dir: string): string[] {
        let files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const srcFiles = scanDir(path.resolve('src'));
      const networkApis = ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon', 'new WebSocket('];

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const api of networkApis) {
          assert.ok(
            !content.includes(api),
            `파일 ${path.basename(file)}에 외부 통신 API(${api})가 존재해서는 안 됩니다.`
          );
        }
      }
    });

    it('프로덕션 번들(dist/assets/index.js)에 외부 통신 페이로드가 유입되지 않아야 한다', () => {
      const bundlePath = path.resolve('dist/assets/index.js');
      assert.ok(fs.existsSync(bundlePath), 'dist/assets/index.js 번들이 존재해야 합니다.');

      const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
      assert.ok(
        !bundleContent.includes('google-analytics') &&
          !bundleContent.includes('googletagmanager') &&
          !bundleContent.includes('mixpanel'),
        '프로덕션 번들에 서드파티 분석 라이브러리가 포함되지 않아야 합니다.'
      );
    });
  });

  describe('3. PII(개인 식별 정보) 및 비밀정보 노출 점검 (No PII & No Secrets)', () => {
    it('입력 폼 및 도메인 인터페이스에 주문번호, 고객명, 연락처, 주소 필드가 0건이어야 한다', () => {
      const rendered = renderToStaticMarkup(React.createElement(App, null));

      // PII 입력 필드 금지
      const piiIdentifiers = [
        '주문번호',
        '고객명',
        '구매자명',
        '전화번호',
        '휴대폰',
        '배송지',
        '수령인',
        '주민등록번호',
        '이메일',
        'orderNumber',
        'customerName',
        'phoneNumber',
        'deliveryAddress',
      ];

      for (const pii of piiIdentifiers) {
        assert.ok(
          !rendered.includes(`name="${pii}"`) && !rendered.includes(`id="${pii}"`),
          `렌더링된 폼에 PII 식별자(${pii}) 필드가 없어야 합니다.`
        );
      }
    });

    it('소스코드(src/)에 하드코딩된 API Key, 비밀번호, 토큰 등 비밀정보가 0건이어야 한다', () => {
      function scanDir(dir: string): string[] {
        let files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const srcFiles = scanDir(path.resolve('src'));
      const secretPatterns = [
        /AKIA[0-9A-Z]{16}/, // AWS Key
        /ghp_[0-9a-zA-Z]{36}/, // GitHub Token
        /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/, // JWT
        /BEGIN PRIVATE KEY/, // Private Key
      ];

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of secretPatterns) {
          assert.ok(
            !pattern.test(content),
            `파일 ${path.basename(file)}에 비밀정보 패턴이 감지되었습니다.`
          );
        }
      }
    });

    it('콘솔 로그(console.log/error)에 사용자의 금융 입력 수치나 민감 데이터가 유출되지 않아야 한다', () => {
      function scanDir(dir: string): string[] {
        let files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const srcFiles = scanDir(path.resolve('src'));
      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        // console.log는 아예 없어야 함
        assert.ok(
          !content.includes('console.log('),
          `파일 ${path.basename(file)}에 console.log가 존재해서는 안 됩니다.`
        );
      }
    });
  });

  describe('4. XSS 및 출력 인코딩 안전 계약', () => {
    it('소스코드에 dangerouslySetInnerHTML, innerHTML, eval()이 0건이어야 한다', () => {
      function scanDir(dir: string): string[] {
        let files: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const srcFiles = scanDir(path.resolve('src'));
      const dangerousPatterns = ['dangerouslySetInnerHTML', '.innerHTML', 'eval('];

      for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of dangerousPatterns) {
          assert.ok(
            !content.includes(pattern),
            `파일 ${path.basename(file)}에 위험한 동적 HTML 삽입(${pattern})이 없어야 합니다.`
          );
        }
      }
    });
  });

  describe('5. 로컬 스토리지 최소 저장 및 프라이버시 계약 (Storage Privacy)', () => {
    it('로컬 스토리지 자동 저장 기본값은 항상 OFF(동의 없이 미저장)여야 한다', () => {
      // explicitUserConsent: false인 경우 저장 차단
      const saved = saveDefaults(
        {
          reverseShippingSellerCost: 3500,
          handlingCost: 1000,
          replacementOutboundShipping: 3500,
          platform: 'NAVER',
        },
        false // 동의 안 함
      );

      assert.strictEqual(saved, false, '동의가 없을 때 저장이 거부되어야 합니다.');
    });

    it('사용자 동의 시에도 비민감 기본값 4종만 저장되고 환급액/PII는 sanitizeDefaults에서 배제되어야 한다', () => {
      const sanitized = sanitizeDefaults({
        reverseShippingSellerCost: 4000,
        handlingCost: 1500,
        replacementOutboundShipping: 4000,
        platform: 'COUPANG',
        refundAmount: 99000, // 개별 주문 환급액
        customerName: '홍길동', // PII 시도
        orderNumber: '20261103-9999', // PII 시도
      });

      // 비민감 4종만 포함
      assert.strictEqual(sanitized.reverseShippingSellerCost, 4000);
      assert.strictEqual(sanitized.handlingCost, 1500);
      assert.strictEqual(sanitized.replacementOutboundShipping, 4000);
      assert.strictEqual(sanitized.platform, 'COUPANG');

      // 환급액 및 PII는 원천 누락 보장
      assert.strictEqual(
        (sanitized as Record<string, unknown>).refundAmount,
        undefined,
        '개별 주문 환급액은 로컬 스토리지 대상에서 배제되어야 합니다.'
      );
      assert.strictEqual(
        (sanitized as Record<string, unknown>).customerName,
        undefined,
        '고객명은 로컬 스토리지 대상에서 배제되어야 합니다.'
      );
      assert.strictEqual(
        (sanitized as Record<string, unknown>).orderNumber,
        undefined,
        '주문번호는 로컬 스토리지 대상에서 배제되어야 합니다.'
      );
    });

    it('clearSavedDefaults 함수가 정의되어 있고 정상 호출 가능해야 한다', () => {
      assert.doesNotThrow(() => {
        clearSavedDefaults();
      }, 'clearSavedDefaults 호출 시 예외 없이 안전 처리되어야 합니다.');
    });
  });

  describe('6. 소스맵(Source Map) 및 스택 트레이스 정책', () => {
    it('프로덕션 빌드 스크립트(scripts/build.mjs)에서 sourcemap이 false로 고정되어야 한다', () => {
      const buildScript = fs.readFileSync(path.resolve('scripts/build.mjs'), 'utf-8');
      assert.ok(
        buildScript.includes('sourcemap: false'),
        '프로덕션 빌드에서 sourcemap: false 설정이 유지되어야 합니다.'
      );

      // dist 디렉토리에 .map 파일이 생성되지 않아야 함
      const distFiles = fs.readdirSync(path.resolve('dist/assets'));
      const mapFiles = distFiles.filter((f) => f.endsWith('.map'));
      assert.strictEqual(
        mapFiles.length,
        0,
        'dist/assets 디렉토리에 .map 소스맵 파일이 존재해서는 안 됩니다.'
      );
    });
  });

  describe('7. 개인정보 처리방침 문구 및 법률 고지 대조 (Disclosures Alignment)', () => {
    it('PRIVACY_POLICY_SUMMARY에 No-PII 및 100% 브라우저 로컬 연산 원칙이 명시되어야 한다', () => {
      assert.ok(
        PRIVACY_POLICY_SUMMARY.includes('개인 식별 정보(PII) 미수집 원칙'),
        '방침에 PII 미수집 원칙이 선언되어야 합니다.'
      );
      assert.ok(
        PRIVACY_POLICY_SUMMARY.includes('100% 브라우저 로컬 연산'),
        '방침에 로컬 연산 및 외부 전송 부재가 선언되어야 합니다.'
      );
      assert.ok(
        PRIVACY_POLICY_SUMMARY.includes('제3자 트래커 및 쿠키 미사용'),
        '방침에 트래커/쿠키 미사용이 선언되어야 합니다.'
      );
    });

    it('LEGAL_DISCLAIMER_TEXT에 변호사법/세무사법 비자문 고지가 명시되어야 한다', () => {
      assert.ok(
        LEGAL_DISCLAIMER_TEXT.includes('변호사법에 따른 법률 자문이나 세무사법에 따른 세무 자문'),
        '법률 면책 고지에 비자문 원칙이 명시되어야 합니다.'
      );
    });

    it('운영자 정보는 실제 법인 정보 부재 시 임의 날조되지 않고 REVIEW_REQUIRED 상태여야 한다', () => {
      assert.strictEqual(
        OPERATOR_DISCLOSURE.status,
        'REVIEW_REQUIRED',
        '운영자 정보는 실제 서면 승인 전까지 반드시 REVIEW_REQUIRED여야 합니다.'
      );
      assert.ok(
        OPERATOR_DISCLOSURE.companyName.includes('사람 승인 대기'),
        '운영자 상호에 [사람 승인 대기] 상태가 명시되어야 합니다.'
      );
    });
  });
});
