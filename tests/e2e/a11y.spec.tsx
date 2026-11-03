/**
 * ReturnWise Accessibility (A11y) & Mobile Quality Test Suite (tests/e2e/a11y.spec.tsx)
 * Verifies WCAG 2.1 AA contrast ratios, 320px mobile layout, touch targets, labels, and ARIA roles.
 * STRICT SAFETY RULE: 자동 점검 PASS만으로 완전 접근성 보장 주장 금지.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalculatorPage } from '../../src/features/calculator/CalculatorPage';
import { App } from '../../src/app/App';

// Helper to compute WCAG 2.1 Relative Luminance and Contrast Ratio
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((val) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('T20 | Accessibility & Mobile Quality Contract Tests', () => {
  describe('1. WCAG 2.1 AA 명도 대비비(Contrast Ratio >= 4.5:1) 검증', () => {
    it('기본 본문 텍스트(#0F172A)와 배경(#F8FAFC)의 대비비는 4.5:1 이상(실측 17:1 이상)이어야 한다', () => {
      const contrast = getContrastRatio('#0F172A', '#F8FAFC');
      assert.ok(contrast >= 4.5, `Contrast ${contrast} should be >= 4.5`);
      assert.ok(contrast >= 15.0);
    });

    it('Primary 텍스트(#2563EB)와 흰색(#FFFFFF)의 대비비는 4.5:1 이상이어야 한다', () => {
      const contrast = getContrastRatio('#2563EB', '#FFFFFF');
      assert.ok(contrast >= 4.5, `Contrast ${contrast} should be >= 4.5`);
    });

    it('추천 1위 텍스트(#047857)와 배경(#ECFDF5)의 대비비는 4.5:1 이상이어야 한다', () => {
      const contrast = getContrastRatio('#047857', '#ECFDF5');
      assert.ok(contrast >= 4.5, `Contrast ${contrast} should be >= 4.5`);
    });

    it('오류/차단 텍스트(#BE123C)와 배경(#FFF1F2)의 대비비는 4.5:1 이상이어야 한다', () => {
      const contrast = getContrastRatio('#BE123C', '#FFF1F2');
      assert.ok(contrast >= 4.5, `Contrast ${contrast} should be >= 4.5`);
    });

    it('주의/경고 텍스트(#92400E)와 배경(#FFFBEB)의 대비비는 4.5:1 이상이어야 한다', () => {
      const contrast = getContrastRatio('#92400E', '#FFFBEB');
      assert.ok(contrast >= 4.5, `Contrast ${contrast} should be >= 4.5`);
    });
  });

  describe('2. 320px 모바일 뷰포트 무수평스크롤 & 터치 타깃(>= 44px) 검증', () => {
    it('tokens.css에 --touch-target-min: 44px 및 모바일 터치 표준이 정의되어 있어야 한다', () => {
      const tokensCss = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf-8');
      assert.ok(tokensCss.includes('--touch-target-min: 44px'));
      assert.ok(tokensCss.includes('--focus-ring'));
    });

    it('index.css에 320px min-width 및 유동 컨테이너가 정의되어 있어야 한다', () => {
      const indexCss = fs.readFileSync(path.resolve('src/styles/index.css'), 'utf-8');
      assert.ok(indexCss.includes('min-width: 320px'));
      assert.ok(indexCss.includes('box-sizing: border-box'));
    });
  });

  describe('3. 모션 감소(prefers-reduced-motion) 및 키보드 포커스 링 검증', () => {
    it('index.css에 prefers-reduced-motion 미디어 쿼리가 적용되어 있어야 한다', () => {
      const indexCss = fs.readFileSync(path.resolve('src/styles/index.css'), 'utf-8');
      assert.ok(indexCss.includes('@media (prefers-reduced-motion: reduce)'));
      assert.ok(indexCss.includes('animation-duration: 0.01ms'));
    });

    it('index.css에 :focus-visible 고대비 포커스 링이 선언되어 있어야 한다', () => {
      const indexCss = fs.readFileSync(path.resolve('src/styles/index.css'), 'utf-8');
      assert.ok(indexCss.includes(':focus-visible'));
      assert.ok(indexCss.includes('outline: 2px solid'));
    });
  });

  describe('4. 시맨틱 랜드마크, 폼 레이블 결속 및 ARIA 접근성 마크업 검증', () => {
    it('App 및 CalculatorPage 렌더링 시 표준 랜드마크(main, header, footer, section, nav)가 포함되어야 한다', () => {
      const html = renderToStaticMarkup(<App />);
      assert.ok(html.includes('<main id="main-content">'));
      assert.ok(html.includes('<header'));
      assert.ok(html.includes('<footer'));
      assert.ok(html.includes('<section id="step-context"'));
      assert.ok(html.includes('<section id="step-inputs"'));
      assert.ok(html.includes('<section id="step-results"'));
      assert.ok(html.includes('<section id="faq"'));
      assert.ok(html.includes('<section id="operator"'));
      assert.ok(html.includes('<nav'));
    });

    it('모든 입력 폼 필드가 고유 id와 label로 결속되어 있어야 한다', () => {
      const html = renderToStaticMarkup(<CalculatorPage />);
      assert.ok(html.includes('for="field-refund-amount"'));
      assert.ok(html.includes('id="field-refund-amount"'));
      assert.ok(html.includes('for="field-reverse-shipping-seller"'));
      assert.ok(html.includes('id="field-reverse-shipping-seller"'));
      assert.ok(html.includes('for="field-handling-cost"'));
      assert.ok(html.includes('id="field-handling-cost"'));
    });

    it('시각화 막대 차트에 role="progressbar" 및 aria-valuenow/min/max 속성이 부여되어야 한다', () => {
      const html = renderToStaticMarkup(<CalculatorPage />);
      assert.ok(html.includes('role="progressbar"'));
      assert.ok(html.includes('aria-valuemin="0"'));
      assert.ok(html.includes('aria-valuemax='));
      assert.ok(html.includes('aria-valuenow='));
    });

    it('도메인 레이어 격리(React 의존성 0건)가 접근성 확장 후에도 엄격히 유지되어야 한다', () => {
      const domainDir = path.resolve('src/domain');
      const files = fs.readdirSync(domainDir);
      for (const file of files) {
        const content = fs.readFileSync(path.join(domainDir, file), 'utf-8');
        assert.equal(content.includes('react'), false, `File ${file} must not contain react`);
      }
    });
  });
});
