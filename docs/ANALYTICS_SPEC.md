# ReturnWise 익명 방문계측 및 지표 증거 수집 명세서 (ANALYTICS_SPEC.md)

- **문서 목적**: $0 최소 비용과 강력한 프라이버시 보호 하에 방문 및 초기 전환 가설을 검증하기 위한 측정 체계 정의
- **프로젝트**: ReturnWise (반품·환불·교환 비용 비교 계산기)
- **적용 단계**: G3 / 무료 MVP 및 사업검증 단계
- **최종 판정**: **PASS**

---

## 1. 아키텍처 원칙 (Zero-Budget & Privacy-First)

ReturnWise는 금융 입력값과 판매자 원가를 다루는 도구이므로, 기존 상용 분석 도구(Google Analytics, Amplitude, Mixpanel, Hotjar)의 무분별한 데이터 수집을 **원천 금지**합니다.

1. **$0 운영 예산 원칙 (C01/ADR-01 준수)**: 유료 SaaS 분석 도구 구독 0원. Cloudflare Pages 내장 무료 Web Analytics(WA) 활용.
2. **No-Cookie & No-PII**: 방문자 브라우저에 쿠키를 생성하지 않으며, IP 주소나 기기 핑거프린팅을 영구 저장하지 않는 익명 계측만 허용.
3. **URL 파라미터 무결성**: 계산 결과나 입력 금액이 URL 쿼리 파라미터(`?amount=...`)에 유출되지 않도록 강제.
4. **특별 안전조건 엄수**: 개인 식별자(성명, 연락처, 주문번호) 및 세부 주문 데이터의 분석 도구 수집을 엄격히 금지.

---

## 2. 3대 지표 소스의 분리 (Measurement Sources)

방문, 검색 노출, 정성 피드백을 단일 도구로 왜곡 통합하지 않고, 3개의 독립된 진실의 원천(Source of Truth)으로 분리 관리합니다:

| 계측 소스 | 대상 플랫폼 | 주요 지표 | 한계 및 주의사항 |
|---|---|---|---|
| **Source 1: 방문 트래픽** | Cloudflare Web Analytics (WA) | 순 방문자(UV), 페이지뷰(PV), 국가, 기기 유형, Top Referrer | 커스텀 이벤트(클릭/계산) 미지원 |
| **Source 2: 검색 노출** | Google Search Console & Naver Search Advisor | 검색 노출수(Impressions), 클릭수, CTR, 주요 질의어(Queries) | 실제 온사이트 체류시간 미포함 |
| **Source 3: 정성 피드백** | 판매자 1:1 인터뷰 & 커뮤니티 질의 (수동 집계) | 실사용 불편사항, 누락 비용 항목 건의, 지불의사(WTP) 신호 | 정량적 통계가 아닌 정성 가설 검증용 |

---

## 3. Cloudflare Web Analytics (WA) 한계 및 진실성 고지

> **핵심 원칙**: WA는 Custom Event를 지원하지 않으므로, 클릭/계산 완료를 자동 추적했다고 절대 주장하지 않습니다. 이벤트 미측정은 **`미측정`**으로 투명하게 표기합니다.

### 3.1 WA의 실제 측정 가능 범위
- 페이지 로드 이벤트(Page Load)
- 브라우저 Web Vitals (FCP, LCP, CLS, FID)
- 유입 도메인(Referrer Host)
- 운영체제 및 브라우저 패밀리

### 3.2 WA의 불가능 범위 (진실성 고지)
- 계산기 폼 입력값 및 0원/미입력 구분 추적 불가
- 대안 탭 전환(`ECONOMIC_COST` vs `CASH_OUTFLOW`) 클릭 추적 불가
- [익명 요약 리포트 복사] 버튼 클릭 이벤트 추적 불가
- [1클릭 예시 불러오기] 및 [전체 초기화] 클릭 추적 불가

### 3.3 온사이트 인터랙션 가설 검증 방식
- 클라이언트 인터랙션은 자동 트래커 대신 **`docs/METRIC_WEEKLY_TEMPLATE.md`**를 통한 **판매자 수동 인터뷰 집계(Source 3)**로 가설을 검증합니다.

---

## 4. Cloudflare Web Analytics 도입 절차 (운영자 가이드)

무료 MVP 배포 후 사람 운영자(회기님)의 승인을 거쳐 도입하는 표준 절차입니다:

1. **Cloudflare 대시보드 접속**:
   - `Cloudflare Dashboard` -> `Web Analytics` -> `Manage Site` -> `Add a site` 선택.
   - 도메인 `returnwise.pages.dev` (또는 커스텀 도메인) 등록.
2. **JS Beacon 토큰 발급**:
   - Cloudflare에서 생성된 고유 `CF-Beacon-Token` 확인.
3. **CSP 헤더 갱신 필요사항**:
   - Web Analytics 비콘 적용 시 `public/_headers`의 CSP에 `script-src 'self' https://static.cloudflareinsights.com;` 및 `connect-src 'none' https://cloudflareinsights.com;`으로의 통제된 확장이 요구됨 (별도 검토 후 반영).
4. **특별 안전조건 확인**:
   - 비콘 삽입 시 사용자 입력 폼에 스크립트 접근 권한을 부여하지 않는지 무결성 검증.

---

## 5. 신규 이벤트 백엔드(Custom Event Backend) 도입 선행 조건

향후 계산기 클릭률이나 복사 완료율을 서버에서 집계하는 자체 이벤트 백엔드를 도입하고자 할 경우, 다음 4대 선행 요건을 충족하고 **별도 기술 의사결정 기록(ADR)**을 승인받아야 합니다:

1. **개인정보보호법 검토**: 익명 세션 식별자 사용 시에도 법적 동의 배너가 필요한지 검토.
2. **인프라 비용 검토**: Cloudflare Workers D1 또는 KV 사용 시 $0 무료 티어 한도 내 운영 가능 여부 실측.
3. **클라이언트 성능 검토**: 추가 비동기 HTTP 요청이 FCP/LCP를 저하시키지 않는지 검증.
4. **ADR 공식 승인**: `docs/ADR/ADR-03_EVENT_ANALYTICS_BACKEND.md` 문서화 및 사람 승인 완료 후 구현 착수.
