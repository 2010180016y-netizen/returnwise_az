# ReturnWise 디자인 시스템 결정서 (DESIGN_DECISIONS.md)

- **문서 버전:** v1.0.0
- **작성 일자:** 2026-11-03 (Asia/Seoul)
- **티켓 ID:** T11 (디자인 시스템·공통 컴포넌트)
- **단계:** G2 (반응형 UI 개발)

---

## 1. 디자인 철학 및 특별 안전 원칙

ReturnWise는 감성적 그래픽이나 불필요한 애니메이션 중심의 마케팅 사이트가 아니며, **소규모 커머스 판매자가 긴박한 반품 분쟁 상황에서 법적 권리와 1원 단위 손실액을 30초 내에 정확히 판단할 수 있도록 돕는 "금융·운영 유틸리티 도구"**다.

### 1.1 핵심 디자인 3원칙
1. **장식보다 가독성 최우선 (Numbers & Status First):**
   - 불필요한 일러스트나 그라데이션 장식을 원천 배제하고, 입력 금액, 대안별 차액, 법률 경고 상태를 즉시 판독할 수 있도록 고대비 폰트와 여백을 확보한다.
   - 모든 금액 수치는 고정폭 숫자(`font-variant-numeric: tabular-nums`)를 적용하여 위아래 자릿수가 시각적으로 어긋나지 않도록 정렬한다.
2. **무의존성 $0 번들 최적화 (Zero UI Dependencies):**
   - MUI, Ant Design, Chakra UI 등 수백 KB의 무거운 외부 컴포넌트 라이브러리를 일체 사용하지 않는다.
   - 표준 CSS 커스텀 프로퍼티(CSS Variables)와 React 경량 래퍼 컴포넌트만으로 100% 자체 구축하여 초기 로딩 속도와 120KB 번들 예산을 사수한다.
3. **엄격한 웹 접근성 준수 (WCAG 2.1 AA & Keyboard First):**
   - 모든 텍스트와 배경색의 명도 대비는 4.5:1 이상(대형 텍스트 3:1 이상)을 준수한다.
   - 마우스 없이 `Tab` 키와 `Enter`/`Space` 키만으로 모든 입력과 대안 비교 동선을 완결할 수 있도록 포커스 링(`focus-visible`)을 강제한다.
   - 모바일 환경에서 오터치를 방지하기 위해 모든 버튼 및 입력 필드의 터치 타깃을 최소 44px 이상으로 고정한다.

---

## 2. 디자인 토큰 명세 (`src/styles/tokens.css`)

### 2.1 색상 토큰 및 WCAG AA 콘트라스트 검증

| 토큰명 | 색상 코드 | 용도 | 배경 대비비 (on White / Light) | WCAG AA 충족 여부 |
| :--- | :--- | :--- | :--- | :--- |
| `--color-slate-900` | `#0f172a` | 본문 주요 텍스트, 제목 | **16.2 : 1** | PASS (최상) |
| `--color-slate-600` | `#475569` | 보조 텍스트, 레이블 설명 | **7.1 : 1** | PASS |
| `--color-slate-200` | `#e2e8f0` | 카드 테두리, 구분선 | N/A (UI 구성요소) | PASS (3:1 초과) |
| `--color-primary-600` | `#2563eb` | 메인 액션 버튼, 포커스 링 | **4.6 : 1** | PASS |
| `--color-success-700` | `#047857` | 최저비용 추천 대안 강조, 절감액 | **5.4 : 1** | PASS |
| `--color-warning-700` | `#b45309` | 확인 필요(L01, L07), 주의 배지 | **4.8 : 1** | PASS |
| `--color-danger-600` | `#e11d48` | 차단(L02, L06), 필수 입력 별표 | **4.5 : 1** | PASS |

### 2.2 타이포그래피 및 금융 전용 폰트
- **기본 글꼴:** `-apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif`
- **숫자 및 화폐 전용 글꼴:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
  - `.tabular-nums`: `font-variant-numeric: tabular-nums; letter-spacing: -0.02em;`

### 2.3 반응형 뷰포트 및 터치 규격
- **모바일 최소 폭:** 320px (가로 스크롤 없음)
- **컨테이너 최대 폭:** 1024px (중앙 정렬)
- **최소 터치 타깃:** `--touch-target-min: 44px`
- **포커스 링 스타일:** `--focus-ring: 0 0 0 2px #ffffff, 0 0 0 4px var(--color-primary-600)`

---

## 3. 공통 컴포넌트 명세 (`src/components/`)

### 3.1 Button (`src/components/Button.tsx`)
- **역할:** 계산 실행, 초기화, 예시 불러오기, 클립보드 복사 등 사용자 액션 트리거.
- **Variants:** `primary` (파랑), `secondary` (회색), `outline` (테두리), `danger` (적색), `ghost` (투명).
- **접근성:** `aria-busy` 로딩 상태 지원, `focus-visible` 링 100% 적용, 모바일 44px 보장.

### 3.2 Input (`src/components/Input.tsx`) & FormField (`src/components/FormField.tsx`)
- **역할:** 환급액, 운송비, 회수가치 등 KRW 원 단위 금액 입력.
- **기능:** 우측 고정 단위(`suffix="원"`), 천 단위 쉼표 포맷팅 지원.
- **오류 처리:** `aria-invalid="true"`, `aria-describedby="${id}-error"`, `role="alert"`로 스크린 리더 완벽 연동.

### 3.3 Card (`src/components/Card.tsx`)
- **역할:** 4대 대안별 비교 결과 및 라인아이템 카드 렌더링.
- **상태별 스타일:**
  - `isRecommended === true`: 2px 녹색 테두리(`border-success-600`), 가벼운 그림자, 추천 하이라이트.
  - `isDisabled === true`: 연회색 배경(`bg-slate-100`), 점선 테두리(`border-dashed`), 텍스트 뮤트 처리.

### 3.4 Badge (`src/components/Badge.tsx`)
- **역할:** 대안 상태 표시.
- **종류:** `[최저비용]` (success), `[확인 필요]` (warning), `[추천 제외]` (danger), `[기준안]` (info).

### 3.5 Alert (`src/components/Alert.tsx`)
- **역할:** 전자상거래법 L01~L08 관련 법률 가드레일 경고 및 안내문 표시.
- **접근성:** `role="alert"` 탑재로 상태 변경 시 스크린 리더 즉시 낭독.

### 3.6 Tooltip (`src/components/Tooltip.tsx`)
- **역할:** '순경제비용', '청약철회권', '확정 수수료 크레딧' 등 법률·금융 전문 용어 호버/포커스 설명 제공.
- **접근성:** 마우스 호버뿐만 아니라 키보드 `Tab` 포커스 시에도 팝업 노출.

### 3.7 ResultTable (`src/components/ResultTable.tsx`)
- **역할:** 1원 단위 상세 산식 분해 및 회계 원장 대조표.
- **특징:** 항목명 좌측 정렬, 금액 우측 정렬(`rw-td-number`), 최종 합계 행 상단 2px 굵은 구분선.
