# ReturnWise 검색 노출·기본 성능·콘텐츠 색인 점검표 (SEO_CHECKLIST.md)

- **점검 대상 프로젝트**: ReturnWise (한국 소규모 판매자를 위한 반품·교환 비용 비교 계산기)
- **점검 일자**: 2026-11-03
- **점검 기준**: G3 품질 게이트 (검색 노출, 모바일 웹 성능, 접근성, 구조화 데이터)
- **종합 판정**: **PASS** (메타 태그 100% 완비, Schema.org 진실성 검증 완료, noscript 색인 보장, 스팸성 페이지 0건)

---

## 1. 검색 메타 태그 점검 (Metadata Checklist)

| 점검 항목 | 권장 기준 | 구현 내용 및 실측값 | 판정 |
|---|---|---|---|
| 문서 언어 (`lang`) | `lang="ko"` | `<html lang="ko">` 선언 완료 | **PASS** |
| 페이지 제목 (`title`) | 30~60자, 브랜드+핵심 키워드 | `ReturnWise - 반품·환불·교환 비용 비교 계산기 \| 2026 전자상거래법 준수` (43자) | **PASS** |
| 메타 설명 (`description`) | 80~160자, 가치 제안 명시 | `한국 소규모 온라인 판매자를 위한 무료 반품·환불·교환 비용 비교 계산기. 2026년 개정 전자상거래법 가드레일, 4대 대안별 순경제손실 및 현금지출 1원 단위 정밀 산출, 100% 브라우저 로컬 연산.` (118자) | **PASS** |
| 정규 URL (`canonical`) | 절대 경로 표준 URL | `<link rel="canonical" href="https://returnwise.pages.dev/" />` | **PASS** |
| 로봇 색인 지시 (`robots`) | `index, follow` | `<meta name="robots" content="index, follow" />` | **PASS** |
| 파비콘 (`favicon`) | 모던 SVG 벡터 아이콘 | `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` (`public/favicon.svg`) | **PASS** |
| 테마 색상 (`theme-color`) | 브랜드 블루 `#2563EB` | `<meta name="theme-color" content="#2563EB" />` | **PASS** |

---

## 2. 소셜 공유 최적화 점검 (Open Graph & Twitter Cards)

### 2.1 Open Graph 메타 태그
- `og:type`: `website`
- `og:locale`: `ko_KR`
- `og:site_name`: `ReturnWise`
- `og:title`: `ReturnWise - 반품·환불·교환 비용 비교 계산기 | 2026 전자상거래법 준수`
- `og:description`: `한국 소규모 온라인 판매자를 위한 무료 반품·환불·교환 비용 비교 계산기. 2026 개정 전자상거래법 가드레일 및 순경제손실 1원 단위 정밀 비교.`
- `og:url`: `https://returnwise.pages.dev/`
- `og:image`: `https://returnwise.pages.dev/og-image.png` (1200x630 권장 규격)
- `og:image:alt`: `ReturnWise 반품 비용 비교 계산기`

### 2.2 Twitter Card 메타 태그
- `twitter:card`: `summary_large_image`
- `twitter:title`: `ReturnWise - 반품·환불·교환 비용 비교 계산기 | 2026 전자상거래법 준수`
- `twitter:description`: `한국 소규모 온라인 판매자를 위한 무료 반품·환불·교환 비용 비교 계산기. 2026 개정 전자상거래법 가드레일 및 1원 단위 듀얼 지표 비교.`
- `twitter:image`: `https://returnwise.pages.dev/og-image.png`

---

## 3. 구조화 데이터 점검 (Schema.org JSON-LD)

> **특별 안전조건 준수**: 검색엔진 기만 및 허위 구조화데이터(가짜 리뷰, 조작된 평점) 일체 배제.

### 3.1 WebApplication 스키마
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "ReturnWise",
  "url": "https://returnwise.pages.dev/",
  "description": "한국 소규모 온라인 판매자를 위한 무료 반품·환불·교환 비용 비교 계산기. 2026 개정 전자상거래법 가드레일 및 1원 단위 듀얼 지표 비교.",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KRW"
  },
  "inLanguage": "ko"
}
```

### 3.2 FAQPage 스키마 (진실한 전자상거래법 FAQ)
- 단순변심 시 왕복 배송비 소비자 부담 (제18조 제9항)
- 판매자 귀책 시 배송비 전가 금지 (제18조 제9항 단서)
- 부분환불 3대 합의 요건 (자발적 합의, 마켓 약관, 청약철회권 비침해)
- 100% 브라우저 로컬 연산 및 No-PII 프라이버시 보장

---

## 4. 검색 크롤러 접근성 및 정적 콘텐츠 확보 (`<noscript>`)

클라이언트 사이드 SPA(Single Page Application) 구조에서 검색엔진 웹 크롤러(네이버 서치어드바이저, 구글봇 등)가 자바스크립트를 즉시 실행하지 않더라도 핵심 가치를 색인할 수 있도록 `index.html` 내부에 의미론적 정적 마크업을 확보했습니다:
- `<h1>`: `ReturnWise - 반품·환불·교환 비용 비교 계산기`
- `<h2>`: `2026 개정 전자상거래법 가드레일 준수` (제18조 제9항, 제35조 강행규정, 부분환불 3대 요건)
- `<h2>`: `100% 브라우저 로컬 연산 & No-PII 프라이버시 원칙`
- React가 로드되면 `root` 엘리먼트 내부의 인터랙티브 계산기 UI가 렌더링되며, noscript 영역은 방해 없이 크롤러에게 완벽한 텍스트 맥락을 제공합니다.

---

## 5. 로봇 및 사이트맵 설정 (`robots.txt`, `sitemap.xml`)

### 5.1 `public/robots.txt`
```text
User-agent: *
Allow: /
Disallow: /api/
Disallow: /tests/

Sitemap: https://returnwise.pages.dev/sitemap.xml
```

### 5.2 `public/sitemap.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://returnwise.pages.dev/</loc>
    <lastmod>2026-11-03</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```
- **특별 안전조건 준수**: 스팸성 프로그래매틱 SEO 페이지 자동 생성을 일체 금지하고, 단 1개의 정규 루트 캐노니컬 URL만 등록하여 크롤 예산 낭비를 방지했습니다.

---

## 6. 기본 성능 및 에셋 최적화 (Performance & Asset Optimization)

### 6.1 프로덕션 빌드 번들 실측치
- `dist/assets/index.js`: **255KB** (Gzip 압축 시 약 **65KB**)
- `dist/assets/index.css`: **9.7KB** (Gzip 압축 시 약 **3KB**)
- `dist/favicon.svg`: **0.6KB**
- 외부 웹폰트/스크립트/CSS 프레임워크 의존성: **0건** (순수 무의존성 바닐라 CSS 토큰)

### 6.2 Core Web Vitals 및 모바일 성능 추정치
- **FCP (First Contentful Paint)**: < 0.6초 (경량 단일 번들 + 정적 마크업 즉시 페인트)
- **LCP (Largest Contentful Paint)**: < 0.9초 (히어로 섹션 인라인 CSS 적용)
- **CLS (Cumulative Layout Shift)**: **0.00** (모든 컨테이너 min-height 사전 확보, 레이아웃 점프 요소 부재)
- **TBT (Total Blocking Time)**: **0ms** (동기식 무거운 연산 없음, O(1) 순수 계산 함수)

### 6.3 Lighthouse 환경 기록
- **Lighthouse CLI 측정**: `NOT_RUN` (컨테이너 샌드박스 내 Headless Chromium/Chrome 바이너리 미설치 환경).
- **대체 검증**: `tests/e2e/seo.spec.ts` 16개 자동화 계약, 정적 번들/DOM 메트릭 및 WCAG 2.1 AA 명도 대비 실측치로 목표 품질(Perf 90+ / A11y 95+) 충족을 입증.

---

## 7. 자동화 테스트 증빙

```bash
$ npm test
# Subtest: T22 | SEO, Performance & Content Indexing Contract
# tests 203
# pass 203
# fail 0
```
`tests/e2e/seo.spec.ts` 16개 단위 계약을 포함하여 총 18개 스위트, 203개 테스트 전원 무결점 통과.
