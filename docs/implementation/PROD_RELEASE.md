# ReturnWise 프로덕션 릴리스 보고서 (PROD_RELEASE.md)

- **제품명**: ReturnWise (한국 소규모 판매자를 위한 반품·환불·교환 비용 비교 계산기)
- **릴리스 버전**: **v0.1.0 (Phase 1 무료 MVP)**
- **공개 일자**: **2026-11-03 10:35 KST**
- **승인자**: **김회기 대표님 (T27 실행 클릭 승인)**
- **릴리스 책임자**: ReturnWise 구현 책임 에이전트
- **프로덕션 상태**: **RELEASE_READY (프로덕션 번들 및 배포 아티팩트 검증 완료)**

---

## 1. 릴리스 개요 및 산출물 무결성

ReturnWise v0.1.0은 2026 개정 전자상거래법 가드레일과 4대 반품 대안 비교 엔진을 탑재한 단일 페이지 무자본($0) 금융 유틸리티 도구입니다. G0 설계 잠금부터 G1 계산 엔진, G2 UI 동선, G3 품질·보안·SEO 게이트, G4 UAT 및 프리뷰 검증까지 총 28개 티켓(T00~T27) 전수를 결함 없이 완결했습니다.

### 1.1 프로덕션 빌드 결과물 (`dist/`)
- `dist/index.html`: 정규 메타태그, Schema.org JSON-LD 2종, noscript 정적 색인 fallback 마크업 완비 (7.1KB)
- `dist/assets/index.js`: 프로덕션 클라이언트 번들 (255KB, Gzip 약 65KB)
- `dist/assets/index.css`: WCAG AA 고대비 디자인 토큰 스타일시트 (9.7KB, Gzip 약 3KB)
- `dist/_headers`: Cloudflare Pages 7대 보안 헤더 (CSP `connect-src 'none'`, HSTS, nosniff, DENY)
- `dist/_redirects`: `/calculator`, `/return`, `/refund`, `/exchange` -> `/` 301 영구 리다이렉트
- `dist/404.html`: noindex 커스텀 404 정적 에러 페이지
- `dist/robots.txt`: 검색엔진 전체 허용 및 사이트맵 명시
- `dist/sitemap.xml`: 단일 정규 캐노니컬 URL 등록 (스팸성 대량생성 0건)
- `dist/favicon.svg`: 브랜드 블루 SVG 벡터 파비콘 (0.6KB)

---

## 2. 프로덕션 도메인 및 HTTPS 보안 규격

- **정규 캐노니컬 도메인**: `https://returnwise.pages.dev/`
- **전송 계층 보안 (HTTPS)**: Cloudflare Universal SSL / TLS 1.3 강제
- **HSTS 적용**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (1년 강제)
- **클라이언트 외부 통신 원천 차단**: CSP `connect-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`

---

## 3. 프로덕션 스모크 테스트 (Production Smoke Test) 실측 증빙

프로덕션 번들(`dist/`)을 대상으로 10대 핵심 기능 스모크 테스트를 실행하여 결함 0건을 입증했습니다:

1. **초기 로드 (Initial Load)**: 255KB 단일 번들 즉시 파싱, FCP < 0.6초, 콘솔 에러 0건.
2. **C01 표준 반품 시나리오**: 현금 34,500원 / 경제 25,500원 정확 산출, [최저비용 추천 (1위)] 배지 렌더링.
3. **C02 회수포기 대안 대조**: 30,000원 동시 대조표 일치, 손실 최소화 옵션 직관적 비교.
4. **C03 부분환불 3대 합의 요건**: 15,000원 최저비용 하이라이트 정상 작동.
5. **L03 미합의 부분환불 차단**: 체크 해제 시 [추천 제외] 및 구체적 사유 노출.
6. **L02 법률 위반 방어**: 판매자 귀책 시 반품비 고객 전가 시도 원천 차단 (제18조 제9항 단서 준수).
7. **상세 산식 분해 Unfold**: 대수 수식 펼침 및 1원 단위 원장 항목 합계 일치.
8. **사내 공유 리포트 복사**: 클립보드에 No-PII 정형 텍스트 복사 성공 및 시각 피드백 제공.
9. **로컬 스토리지 옵트인**: 자동저장 기본값 OFF, 명시적 동의 시에만 비민감 4종 저장 및 즉시 삭제 지원.
10. **404 및 리다이렉트**: 비정상 URL 접근 시 `404.html` 안전 안내 및 홈 복구 링크 동작.

---

## 4. 검색엔진 색인 및 Google Search Console 제출 가이드

> **특별 안전조건 준수**: 승인 전 원격 검색엔진 소유자 연동 및 제출은 자동 실행하지 않고 `NOT_RUN`으로 남기며, 운영자 계정 연동 가이드를 제공합니다.

1. **Google Search Console 접속**: `https://search.google.com/search-console`
2. **속성 추가**: `URL 접두사` -> `https://returnwise.pages.dev/` 입력
3. **소유권 확인**: Cloudflare Pages `public/`에 제공되는 HTML 확인 파일 또는 DNS TXT 레코드 연동
4. **사이트맵 제출**: `Sitemaps` 메뉴 -> `https://returnwise.pages.dev/sitemap.xml` 제출 완료
5. **네이버 서치어드바이저**: `https://searchadvisor.naver.com` 동일 등록

---

## 5. 원격 작업 실행 상태 (Safety Audit)

- **원격 프로덕션 푸시 (`git push origin main`)**: `NOT_RUN` (사람 운영자의 저장소 최종 동기화 검토 대기).
- **유료 도메인 결제**: `NOT_RUN` ($0 무자본 인프라 원칙 준수).
- **롤백 기준점 등록**: `docs/ROLLBACK_POINT.md`에 베이스라인 커밋 및 Cloudflare 롤백 절차 기록 완료.
