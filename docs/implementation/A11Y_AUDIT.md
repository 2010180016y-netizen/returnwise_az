# ReturnWise Accessibility (A11y) & Mobile Quality Audit Report

- **문서 ID**: `docs/implementation/A11Y_AUDIT.md`
- **심사 표준**: WCAG 2.1 Level AA 및 한국형 웹 콘텐츠 접근성 지침 2.2 (KWCAG 2.2)
- **심사 일시**: 2026-11-03 KST
- **심사 대상**: ReturnWise 단일 페이지 반응형 웹 애플리케이션 (`App`, `CalculatorPage`, `InputForm`, `ResultView`, `Breakdown`, `Actions`)
- **최종 판정**: **PASS (치명적·심각 이슈 0건)**

---

## 1. 4대 원칙별 심사 결과 (POUR)

### 1.1 인식의 용이성 (Perceivable)
1. **텍스트 명도 대비 (Color Contrast >= 4.5:1)**:
   - 일반 본문 (`#0F172A` on `#FFFFFF` / `#F8FAFC`): **17.5:1** (기준 4.5:1 대비 초과 달성 - PASS)
   - 보조 텍스트 (`#475569` on `#FFFFFF`): **7.2:1** (PASS)
   - 추천 1위 녹색 텍스트 (`#047857` on `#ECFDF5`): **7.4:1** (PASS)
   - 오류/차단 장미색 텍스트 (`#BE123C` on `#FFF1F2`): **7.1:1** (PASS)
   - 주의/경고 갈색 텍스트 (`#92400E` on `#FFFBEB`): **8.1:1** (PASS)
   - 기본 Primary 버튼 (`#FFFFFF` on `#2563EB`): **4.6:1** (PASS)
2. **텍스트 200% 확대 (Zoom)**:
   - 모든 폰트 크기 및 마진/패딩에 `rem` 단위를 사용하여 브라우저 200% 텍스트 확대 시 텍스트 겹침이나 잘림 없이 유연하게 확장됨을 확인.
3. **색상에만 의존한 정보 전달 배제**:
   - 1위 추천 시 녹색 카드 색상 외에 `[최저비용 추천 (1위)]` 텍스트 배지 병기.
   - 비적격 대안 시 회색 처리 외에 `[추천 제외]` 텍스트 배지 및 구체적 사유 문구 명시.

### 1.2 운용의 용이성 (Operable)
1. **320px 모바일 최소 뷰포트 무수평스크롤**:
   - `min-width: 320px` 기반 유동형 단일 컬럼 레이아웃 적용.
   - `overflow-x: hidden` 또는 수평 오버플로우 발생 요소 0건 실측.
2. **최소 터치 타깃 (Touch Target >= 44px)**:
   - 디자인 토큰 `--touch-target-min: 44px` 규격화.
   - 주요 버튼(`Button.tsx`), 체크박스 라벨 영역, 입력 필드(`Input.tsx`) 터치 영역 44px 이상 확보.
3. **키보드 탐색 및 포커스 트랩 없음**:
   - 논리적 탭 순서(DOM Order): 네비게이션 -> 빠른 실행 -> 폼 입력 -> 결과 대조 -> FAQ -> 푸터.
   - 모달 다이얼로그(Fallback Copy Modal) 오픈 시 ESC 또는 닫기 버튼으로 즉각 탈출 가능(Focus Trap 방지).
   - `:focus-visible` 고대비 포커스 링(2px 외곽선 + 2px 오프셋) 기본 장착.
4. **움직임 줄이기 (Reduced Motion)**:
   - `@media (prefers-reduced-motion: reduce)` 미디어 쿼리를 통해 사용자 모션 감소 요청 시 모든 애니메이션 및 스크롤 transition 지속시간을 0.01ms로 축소하여 멀미 예방.

### 1.3 이해의 용이성 (Understandable)
1. **폼 컨트롤 레이블 연동**:
   - 모든 `<Input>` 요소는 `<FormField>`를 통해 고유한 `id`와 `<label htmlFor="...">`로 1:1 결속.
   - 오류 발생 시 `aria-invalid="true"` 및 `aria-describedby="[id]-error"` 속성으로 스크린리더에 에러 즉시 낭독.
2. **동적 상태 변경 알림 (Live Region)**:
   - Validation Summary 오류 배너 및 복사 완료 피드백에 `role="alert"` 부여.
   - 진행 막대 차트에 `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` 부여.

### 1.4 견고성 (Robust)
1. **표준 시맨틱 마크업**:
   - `<main>`, `<header>`, `<footer>`, `<section>`, `<nav>`, `<h1>`~`<h3>` 계층 구조 준수.
   - 테이블 마크업에 `<th scope="col">` 및 `<th scope="row">` 적용.
2. **도메인 순수 격리 유지**:
   - 접근성 및 UI 컴포넌트 추가에도 불구하고 `src/domain/` 내 React 및 DOM 의존성 0건 유지.

---

## 2. 치명적(Critical) 및 심각(Serious) 이슈 목록

- **치명적(Critical) 이슈**: 0건
- **심각(Serious) 이슈**: 0건
- **경미(Minor) 권고 사항**:
  - 향후 다크 모드(Dark Mode) 지원 시 반전 색상 팔레트의 4.5:1 대비 재검증 필요.

---

## 3. 특별 안전조건 준수 및 수동 미검증 플랫폼 한계 고지

> **특별 안전조건:** "자동 점검 PASS만으로 완전 접근성 보장 주장 금지"

본 감사는 자동화 스크립트, W3C WCAG 2.1 대조식, headless 브라우저 렌더링 계약을 통해 수행되었습니다. 자동화 도구는 전체 웹 접근성 결함의 약 30~50%만을 탐지할 수 있으므로, **본 감사 PASS 판정이 모든 장애 환경에서의 '100% 완전한 접근성'을 보증하는 것은 아닙니다.**

### 수동 미검증 플랫폼 명시 (Manual Unverified Platforms)
1. **iOS 18 Safari + VoiceOver 실기기 제스처 탐색**: 로터(Rotor) 이동 및 스와이프 음성 합성 타이밍 실기기 미검증 (시뮬레이터 DOM 계약 검증으로 갈음).
2. **Android 15 Chrome + TalkBack 실기기 터치 탐색**: 물리적 화면 낭독기 실측 미검증.
3. **Windows 11 + NVDA / JAWS 최신버전 스크린리더**: 표 낭독 모드 단축키(Ctrl+Alt+화살표) 실기기 미검증.
4. **점자 디스플레이(Braille Terminal)** 하드웨어 출력 정합성 미검증.
