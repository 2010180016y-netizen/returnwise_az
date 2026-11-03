# T21 구현 완료 보고서: 보안·개인정보·의존성 점검

- **티켓 ID**: T21 (보안·개인정보·의존성 점검)
- **단계**: G3 / 무료 MVP 또는 사업검증 단계
- **선행 티켓**: T19 (13대 E2E 여정 완료 확인 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| 의존성 취약점 (Audit) | High / Critical 알려진 취약점 0건 | High 0건, Critical 0건 (프로덕션 런타임 0건) | **PASS** |
| 입력값 외부 전송 | 외부 네트워크 통신 0건 | fetch/XHR/Beacon 0건, CSP `connect-src 'none'` | **PASS** |
| 개인 식별 정보 (PII) | 주문번호, 성명, 연락처 등 PII 필드 0건 | UI 및 도메인 인터페이스 내 PII 0건 | **PASS** |
| 서드파티 애널리틱스 | 민감값 포함 트래커 자동 도입 금지 | GA, GTM, Meta Pixel, Hotjar 등 트래커 0건 | **PASS** |
| 콘솔 및 로그 노출 | 콘솔에 금융 입력값 및 민감정보 노출 0건 | `console.log` 0건, 에러 로그 내 민감값 0건 | **PASS** |
| 보안 응답 헤더 | CSP, HSTS, MIME, Frame, Permissions 선언 | `public/_headers` 및 `dist/_headers` 7종 완비 | **PASS** |
| 소스맵 및 스택 노출 | 프로덕션 번들 소스맵 비노출 | `sourcemap: false`, `.map` 파일 0건 | **PASS** |
| 프라이버시 방침 일치 | 고지 문구와 실제 시스템 동작 100% 일치 | No-PII, 100% 로컬, 선택적 저장 일치 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `package.json` (수정): 미사용 `vitest` 제거, `minimatch ^11.0.4` 오버라이드 등록, `vite@6.4.5` 개발 서버 갱신
2. `package-lock.json` (수정): 의존성 트리 락 갱신 (Critical/High 취약점 0건 달성)
3. `public/_headers` (신규): Cloudflare Pages CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy 보안 헤더 선언
4. `tests/e2e/privacy.spec.ts` (신규): 보안 헤더, 외부 네트워크 0건, No-PII, 비밀정보 0건, 스토리지 프라이버시, 소스맵, 고지 대조 17개 단위 계약 테스트 스위트
5. `docs/SECURITY_AUDIT.md` (신규): 보안·개인정보·의존성 종합 감사 보고서
6. `docs/implementation/T21_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **의존성 취약점 무결성 확보**:
   - 미사용 `vitest` 제거로 `tinypool`(Critical) 원천 해소.
   - `minimatch ^11.0.4` 오버라이드로 ReDoS 취약점 패치.
   - `vite@6.4.5` 업그레이드로 개발 서버 고위험 보안 권고 해결.
   - `npm audit --omit=dev` 기준 프로덕션 런타임 취약점 0건, `npm audit --audit-level=high` 0건 달성.

2. **브라우저 레벨 네트워크 원천 차단 (CSP `connect-src 'none'`)**:
   - `public/_headers`에 `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content;` 선언.
   - 클라이언트 런타임에서 어떠한 형태의 외부 전송도 브라우저에 의해 강제 차단됨을 보장.

3. **No-PII 및 Zero Secrets 아키텍처**:
   - 폼 입력 및 계산 로직에 고객 식별자(주문번호, 이름, 전화번호, 주소)를 원천 배제.
   - 코드베이스 내 비밀키, API 토큰, 자격증명 0건 실측.

4. **로컬 스토리지 최소 저장 및 프라이버시 가드레일**:
   - 자동 저장 기본값 OFF, 사용자 명시적 체크 시에만 비민감 운영값 4종 저장.
   - 90일 TTL 자동 만료 및 원클릭 즉시 영구 삭제(`clearSavedDefaults`) 보장.

5. **특별 안전조건 완벽 준수**:
   - Google Analytics, Tag Manager, Meta Pixel 등 서드파티 추적 스크립트 일체 탑재 금지.
   - 프로덕션 빌드 `sourcemap: false`로 내부 소스 경로 노출 방지.

---

## 4. 실행한 테스트 (명령 및 실측 결과)

```bash
# 1. 의존성 보안 감사 (High/Critical 0건)
$ npm audit --audit-level=high
# exit code: 0, High/Critical vulnerabilities: 0

# 2. 프로덕션 의존성 취약점 점검
$ npm audit --omit=dev
found 0 vulnerabilities

# 3. TypeScript 타입 체크
$ npm run typecheck
> tsc --noEmit
# 0 error (PASS)

# 4. ESLint 코드 스타일 및 보안 검사
$ npm run lint
> eslint .
# 0 error (PASS)

# 5. 프로덕션 빌드 및 정적 헤더 복사 확인
$ npm run build
Building ReturnWise production bundle with esbuild...
Production build completed successfully: dist/
# dist/_headers 파일 복사 정상 확인 (PASS)

# 6. 단위/통합/E2E/보안 전체 테스트 실행
$ npm test
TAP version 13
# Subtest: T20 | Accessibility & Mobile Quality Contract Tests
# Subtest: T19 | 13 Core End-to-End User Journey Scenarios
# Subtest: T21 | Security, Privacy & Dependency Audit Contract
# ... (17개 스위트)
# tests 187
# pass 187
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **로컬 개발 도구 Moderate 경고 (esbuild <=0.24.2)**:
   - 프로덕션 배포 번들(`dist/`)에는 esbuild 바이너리가 포함되지 않는 정적 결과물이므로 사용자 브라우저 환경에 미치는 영향은 0입니다. 향후 esbuild 메이저 버전 안정화 시 추가 갱신 가능합니다.
2. **운영자 사업자 정보 승인 대기**:
   - 현재 `[사람 승인 대기]` 상태(`REVIEW_REQUIRED`)로 봉인되어 있으며, 이는 정식 프로덕션 도메인 릴리스 단계(T26/T27)에서 실제 운영자 정보를 수령하여 사람 승인으로 반영해야 합니다.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T22(검색 노출·기본 성능·콘텐츠 색인)**
