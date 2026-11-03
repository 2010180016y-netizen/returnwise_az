# T16 구현 완료 보고서: 선택적 기본값 로컬 저장

- **티켓 ID**: T16 (선택적 기본값 로컬 저장)
- **단계**: G2 / 무료 MVP 또는 사업검증 단계
- **선행 티켓**: T13 (입력 폼 구현 완료 - `docs/implementation/T13_REPORT.md` PASS)
- **최종 판정**: **PASS**

---

## 1. 실제 변경 파일 목록

1. `src/lib/storage.ts` (신규): 비민감 판매자 기본값 전용 로컬 스토리지 모듈 (Auto-save OFF, TTL 90일, No-PII, 폴백)
2. `src/features/calculator/InputForm.tsx` (수정): STEP 2 하단 판매자 기본값 저장 체크박스, 저장/불러오기/삭제 버튼 및 보안 안내 바 연결
3. `tests/unit/storage.test.ts` (신규): 5대 안전 계약 및 경계 조건(Auto-save OFF, PII 차단, TTL 만료, 무장애 폴백) 단위 테스트 9건
4. `docs/implementation/T16_REPORT.md` (신규): 본 검증 완료 보고서

---

## 2. 구현 핵심 및 안전 계약 준수

### 2.1 명시적 체크 전 저장 0건 (특별 안전조건: 자동 저장 기본값 OFF)
- 사용자가 체크박스("판매자 기본값 이 브라우저에 저장")를 직접 켜지 않고 저장을 시도하거나 앱을 이용할 때는 로컬 스토리지에 1바이트도 쓰지 않음 (`saveDefaults(data, false) === false`).
- UI 체크박스의 초기 상태를 `false`로 엄격 고정.

### 2.2 비민감 판매자 운영 기본값만 선별 저장
- **허용 필드 (4종)**: `reverseShippingSellerCost` (판매자 부담 회수운임), `handlingCost` (기본 검수비), `replacementOutboundShipping` (교환 출고운임), `platform` (판매 마켓).
- **원천 차단 필드 (Blacklisted)**:
  - 개별 주문 환급액 (`refundAmount`, `agreedPartialRefund`)
  - 상품별 잔존가치 (`recoveredItemNetValue`)
  - 고객 요청 및 사유 (`buyerRequest`, `reason`)
  - 주문번호, 고객명, 연락처, 주소 등 PII (0건)

### 2.3 스키마 버전 관리 및 TTL 90일 만료
- `CURRENT_SCHEMA_VERSION = 1`: 구버전 또는 손상된 JSON 파싱 시 스토리지 자동 파기 및 `null` 반환.
- `TTL_MS = 90일`: `expiresAt` 경과 시 스토리지 자동 정리.

### 2.4 브라우저 저장 차단 환경(시크릿 모드/SecurityError) 무장애 폴백
- `isStorageAvailable()`을 통해 `localStorage` 접근 권한을 사전 검증.
- `SecurityError`나 `QuotaExceededError` 발생 시에도 예외를 throw하지 않고 `false`/`null`로 안전하게 무장애 복구.

---

## 3. 실행한 테스트 및 실측 증빙

```bash
$ export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH" && export NODE_OPTIONS="--disable-wasm-trap-handler"
$ cd returnwise_az
$ npm test
# tests 127
# suites 56
# pass 127
# fail 0
# duration_ms 1618.298987

$ npm run typecheck
> tsc --noEmit (0 error PASS)

$ npm run lint
> eslint . (0 error PASS)

$ npm run build
Production build completed successfully: dist/ (assets/index.js 223KB, assets/index.css 9.4KB)

$ grep -rn "react" src/domain/ || echo "NO_REACT_IN_DOMAIN"
NO_REACT_IN_DOMAIN
```

---

## 4. 미검증 및 잔여 위험

- **P0 위험 0건**: Auto-save 기본값 OFF, PII 저장 금지, 90일 TTL 만료, 무장애 폴백, 순수 도메인 격리 100% 검증 완료.
- **클립보드 및 URL 파라미터 복사**: T17 티켓에서 익명 요약 클립보드 복사, fallback, 전체 초기화 및 에러 바운더리 복구 모듈을 통해 완결 예정.

---

## 5. 다음 티켓 진행 가능 여부

- **진행 가능**: 선행 조건(T14, T16)이 모두 PASS로 완결되었으므로, G2 UI 단계의 보조 유틸리티 모듈인 **T17(복사·초기화·예시·비정상 복구)** 티켓으로 즉시 전진 가능합니다.
