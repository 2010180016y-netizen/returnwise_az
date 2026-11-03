# 08. 배포 · 장애대응 · 운영 절차

## 릴리스 전
- `.env.example`는 비밀값 없음; `.env*` 등 비밀 제외, `npm ci`/lockfile 확인.
- CI: lint/typecheck/unit/build/E2E/dependency audit; production approval 필요.
- Domain 결과 fixtures / safety scenarios / 불완전 입력 모두 PASS.
- 실제 한국어 문구, 고지, 사이트 운영 주체, 개인정보/쿠키 사용 여부 확인.
- 모바일 기기/브라우저 직접 또는 자동 테스트.
- Sitemap/canonical/robots/OG/social preview 검증.
- CSP와 보안 헤더 검증, HTTPS, 브라우저 콘솔 오류 없음.
- '정식 오픈' 시 도메인/Google Search Console 소유권은 사용자 명시 승인.

## 배포 방식
Cloudflare Pages Git 연결. Production branch `main`, build=`npm run build`, output=`dist`. PR preview 검토. CI 실패/법률 게이트 미충족이면 프로덕션 금지. 외부 인증 및 계정 조치는 사용자가 수동 승인.

## 사고 수준별 대응
- P0 잘못된 계산/비허용 대안 추천/개인정보 누출 → 즉시 기능 중단 또는 안전 모드/이전 버전 롤백; 이슈 기록; 사용자 고지 필요 여부 점검.
- P1 UX 오류/복사 실패/구성 누락 → 수정 배포 및 회귀 테스트.
- P2 문구 오타/SEO 사소한 이슈 → 정기 배포.

## 롤백
1. 문제 재현 및 타임라인/영향 파악.
2. 가장 최근 검증된 배포로 롤백(권한/가능 여부 수동 확인), CDN 상태 및 DNS 확인.
3. 동일 fixture/안전 테스트와 smoke test 재실행.
4. 원인/재발방지책/재배포 승인 문서화.

## 운영 루틴
- 매주: uptime, 계산 오류/사용자 의견, 키워드/검색 실적, 의존성/보안 업데이트, 고객 인터뷰 진행 현황.
- 매월: 법령/마켓 정책 변경 여부 및 문구 재검토, SEO 품질, 비용, 유료 수요 게이트, 데이터 보존 관련 검토.
- 기능 추가 전 매번: 접근 권한/PII/결제/법률 영향 여부를 체크하고 범위 확정을 기록.

## 실제 지출 사전 승인
도메인 결제, PG 가입비, 유료 분석 API, AI 사용량, Cloudflare 유료 플랜 등은 사용자 승인을 받은 후 진행. 초기에는 Pages 무료 하한 내 운용.
