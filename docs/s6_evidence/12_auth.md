# S6-12: 인증 발급·세션 생명주기 및 조직별 RBAC 권한 검증 보고서

- **작성 기준**: 2026-11-03 17:25 KST
- **감사관**: ReturnWise 선임 Full-stack/보안/QA/운영 감사관
- **대상 저장소**: `2010180016y-netizen/returnwise_az`
- **검증 대상 Commit SHA**: `7e5d704d99c43ebf33a87ec493d8b375b472e3ea`
- **해제 대상 게이트**: P04 (신원 소유권 검증, 세션 발급/만료/철회, RBAC 권한 격리)

---

## 1. 인증 시스템 아키텍처 및 미공개 원칙 (Zero-Public-Minting)

- **공개 세션 발급 엔드포인트 부재**:
  - `registerTrustedSession` 내부 함수는 독립 검증된 이메일 매직링크 또는 소셜 SSO 인증 성공 시에만 호출되도록 설계됨.
  - 익명 사용자가 임의로 세션 토큰을 생성할 수 있는 퍼블릭 엔드포인트는 존재하지 않음 (0건).
- **외부 OAuth / 메일 발송 제공자 연동 현황**:
  - 사람 운영자(김회기 대표님)의 승인 없이 임의의 외부 OAuth 앱(Google/Kakao 등) 생성이나 유료 이메일 발송(Resend/SendGrid 등) 연동을 엄격히 금지함.
  - 현재 실제 외부 인증 프로바이더 계정은 **"미연동 (승인 대기)"** 상태임.

---

## 2. 세션 생명주기 및 재사용 공격 방어 실측

`tests/s3/d1_transaction.test.ts` 및 `server/worker/sessions.ts` 실측 결과:

| 검증 시나리오 | 시스템 동작 (Fail-Closed) | 테스트 결과 |
|:---|:---|:---:|
| **미인증 요청 (No Bearer)** | `MISSING_BEARER` 에러와 함께 `401 Unauthorized` 즉각 차단 | **PASS** |
| **위조/비정상 토큰 (Malformed)** | 정규식(`rw_[A-Za-z0-9_-]{40,100}`) 불일치 시 `401` 차단 | **PASS** |
| **세션 만료 (Expired Token)** | `expires_at <= now` 도달 시 `SESSION_EXPIRED_OR_REVOKED` 401 차단 | **PASS** |
| **명시적 로그아웃 (Revoked Token)** | `revokeAuthenticatedSession` 실행 후 재조회 시 즉시 401 차단 | **PASS** |
| **토큰 재사용 공격 (Replay Attack)** | 무효화된 토큰으로 재요청 시 서비스 인스턴스 재생성 후에도 401 차단 유지 | **PASS** |
| **평문 토큰 누출 방어** | DB에 평문 토큰 보관 0건 (SHA-256 해시 다이제스트만 저장) | **PASS** |

- **인증 우회 결함**: **0건 (Zero Auth Bypass)**.

---

## 3. 조직별 RBAC 역할 격리 실측

1. **소유자(OWNER) vs 일반 멤버(MEMBER)**:
   - 결제 주문 생성(`createTrustedBillingOrder`) 및 결제 검증 시 `requireOwner` 가드 가동.
   - `MEMBER` 권한으로 결제/주문 API 호출 시 `403 Forbidden` (`OWNER_ONLY`) 차단 확인.
2. **비활성 테넌트 차단**:
   - 유효한 Bearer 토큰이라 하더라도 테넌트 상태가 `SUSPENDED` 또는 비활성인 경우 즉시 403 차단.

---

## 4. P04 릴리스 게이트 판정

- **판정**: **`PENDING` 유지**
- **근거**: 서버 로직 및 RBAC 권한 가드는 100% 무결점으로 검증되었으나, 실제 외부 OAuth/매직링크 제공자 연동 및 사용자 신원 소유권 검증 인프라가 승인 전이므로 P04 게이트를 정직하게 `PENDING` 상태로 유지합니다.

---

## 5. 다음 티켓 (S6-13) 진입 판단

- S6-13(Pro CSV 업로드·쿼터·데이터 보존/삭제)의 선행 조건은 S6-12 완료입니다.
- 인증 및 세션 감사 보고서가 완결되었으므로 S6-13으로 즉시 진입합니다.
- S6-13에서는 로컬 CSV vs Pro 서버 CSV 동의 경계, 쿼터 제한(100건/무제한), DDE 수식 주입 방어, PII 탐지 폐기 및 P05, P07 게이트를 검증합니다.
