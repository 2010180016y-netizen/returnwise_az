/**
 * ReturnWise Anonymous Analytics & Metric Integrity Contract Tests (tests/e2e/analytics.spec.ts)
 * Verifies 3 measurement sources separation, honest non-measurement of custom events,
 * zero PII in URLs or storage, and strict prohibition of unauthorized third-party trackers.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 개인 식별자·주문 데이터 분석도구 수집 금지.
 * 2. WA custom event 미지원이므로 클릭/완료 자동 추적 허위 주장 금지 ("미측정" 표기).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

describe('T23 | Anonymous Analytics & Metric Integrity Contract', () => {
  describe('1. 분석 명세서 및 3대 계측 소스 분리 검증 (docs/ANALYTICS_SPEC.md)', () => {
    it('docs/ANALYTICS_SPEC.md 파일이 존재해야 한다', () => {
      const specPath = path.resolve('docs/ANALYTICS_SPEC.md');
      assert.ok(fs.existsSync(specPath), 'docs/ANALYTICS_SPEC.md 파일이 존재해야 합니다.');
    });

    it('방문 트래픽, 검색 노출, 정성 피드백 3대 측정 소스가 명확히 구분되어야 한다', () => {
      const content = fs.readFileSync(path.resolve('docs/ANALYTICS_SPEC.md'), 'utf-8');
      assert.ok(content.includes('Source 1: 방문 트래픽'), 'Source 1(방문 트래픽)이 정의되어야 합니다.');
      assert.ok(content.includes('Cloudflare Web Analytics'), 'Cloudflare Web Analytics가 명시되어야 합니다.');
      assert.ok(content.includes('Source 2: 검색 노출'), 'Source 2(검색 노출)가 정의되어야 합니다.');
      assert.ok(content.includes('Search Console'), 'Search Console이 명시되어야 합니다.');
      assert.ok(content.includes('Source 3: 정성 피드백'), 'Source 3(정성 피드백)이 정의되어야 합니다.');
    });

    it('Cloudflare WA의 커스텀 이벤트 미지원 한계와 "미측정" 원칙이 정직하게 명시되어야 한다', () => {
      const content = fs.readFileSync(path.resolve('docs/ANALYTICS_SPEC.md'), 'utf-8');
      assert.ok(
        content.includes('WA는 Custom Event를 지원하지 않으므로') ||
          content.includes('커스텀 이벤트(클릭/계산) 미지원'),
        'WA의 커스텀 이벤트 미지원 한계가 명시되어야 합니다.'
      );
      assert.ok(
        content.includes('미측정') || content.includes('`미측정`'),
        '이벤트 미측정 항목을 정직하게 미측정으로 표기하는 원칙이 포함되어야 합니다.'
      );
      assert.ok(
        content.includes('클릭/계산 완료를 자동 추적했다고 절대 주장하지 않습니다') ||
          content.includes('자동 추적했다고 주장하지 않음'),
        '허위 추적 주장을 금지하는 원칙이 명시되어야 합니다.'
      );
    });

    it('신규 이벤트 백엔드 도입 시 ADR 사전 승인 요건이 명시되어야 한다', () => {
      const content = fs.readFileSync(path.resolve('docs/ANALYTICS_SPEC.md'), 'utf-8');
      assert.ok(
        content.includes('ADR') || content.includes('의사결정 기록'),
        '신규 이벤트 백엔드 도입을 위한 ADR 요건이 명시되어야 합니다.'
      );
    });
  });

  describe('2. 주간 운영 메트릭 템플릿 검증 (docs/METRIC_WEEKLY_TEMPLATE.md)', () => {
    it('docs/METRIC_WEEKLY_TEMPLATE.md 파일이 존재해야 한다', () => {
      const templatePath = path.resolve('docs/METRIC_WEEKLY_TEMPLATE.md');
      assert.ok(fs.existsSync(templatePath), 'docs/METRIC_WEEKLY_TEMPLATE.md 파일이 존재해야 합니다.');
    });

    it('템플릿에 트래픽, 검색 노출, 사용자 인터뷰 테이블이 모두 포함되어야 한다', () => {
      const content = fs.readFileSync(path.resolve('docs/METRIC_WEEKLY_TEMPLATE.md'), 'utf-8');
      assert.ok(content.includes('Source 1: 트래픽 메트릭'), '트래픽 메트릭 섹션이 존재해야 합니다.');
      assert.ok(content.includes('Source 2: 검색 노출 메트릭'), '검색 노출 메트릭 섹션이 존재해야 합니다.');
      assert.ok(content.includes('Source 3: 사용자 정성 피드백'), '정성 피드백 섹션이 존재해야 합니다.');
    });

    it('클라이언트 인터랙션 이벤트는 "미측정" 상태로 정직하게 기록되어야 한다 (진실성 고지)', () => {
      const content = fs.readFileSync(path.resolve('docs/METRIC_WEEKLY_TEMPLATE.md'), 'utf-8');
      assert.ok(
        content.includes('`미측정`') || content.includes('미측정'),
        '클라이언트 이벤트가 미측정으로 표기되어야 합니다.'
      );
      assert.ok(
        content.includes('클라이언트 인터랙션 및 전환 이벤트'),
        '클라이언트 인터랙션 이벤트 테이블이 존재해야 합니다.'
      );
    });
  });

  describe('3. 특별 안전조건: URL 및 런타임 PII/주문데이터 수집 금지 검증', () => {
    it('소스코드 전체에 URL 쿼리 파라미터로 계산 금액이나 PII를 직렬화하는 코드가 없어야 한다', () => {
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
        // URLSearchParams에 민감 데이터 할당 금지
        assert.ok(
          !content.includes('searchParams.set("refundAmount"') &&
            !content.includes('searchParams.set("customer"'),
          `파일 ${path.basename(file)}에 URL 쿼리로 금융 수치나 고객 정보를 유출하는 로직이 없어야 합니다.`
        );
      }
    });

    it('서드파티 트래커 및 무단 이벤트 전송 라이브러리가 소스코드에 존재하지 않아야 한다', () => {
      const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const forbiddenLibs = [
        'analytics',
        '@analytics/google-analytics',
        'mixpanel',
        'mixpanel-browser',
        'amplitude-js',
        '@amplitude/analytics-browser',
        'hotjar',
        '@hotjar/browser',
      ];

      for (const lib of forbiddenLibs) {
        assert.strictEqual(
          deps[lib],
          undefined,
          `package.json에 비인가 트래커 라이브러리(${lib})가 설치되어서는 안 됩니다.`
        );
      }
    });
  });
});
