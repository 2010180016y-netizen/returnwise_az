# ReturnWise 실행 환경 진단 보고서 (ENVIRONMENT.md)

작성일자: 2026-11-03 (Asia/Seoul)  
티켓 ID: T00 (현 저장소 진단·초기화)  
작성자: Lead Software Architect & QA Lead

---

## 1. 시스템 및 런타임 환경 진단

| 항목 | 실측 버전 / 경로 | 비고 |
| :--- | :--- | :--- |
| **OS / Kernel** | Linux x86_64 (Debian GNU/Linux 12 based) | POSIX 호환 쉘 환경 |
| **Node.js** | `v22.11.0` (`/workspace/.local/node/bin/node`) | LTS 최신 버전 확인 완료 |
| **npm** | `10.9.0` (`/workspace/.local/node/bin/npm`) | Node 22 번들 npm |
| **npx** | `10.9.0` (`/workspace/.local/node/bin/npx`) | 실행 가능 확인 |
| **Git** | `2.43.0` (`/usr/bin/git`) | 버전 관리 정상 동작 |
| **Wrangler (Cloudflare)** | `3.109.2` (`/workspace/.local/bin/wrangler`) | Cloudflare Pages 로컬 프리뷰 지원 |
| **Python** | `3.11.2` (`/usr/bin/python3`) | 보조 스크립팅 및 데이터 검증 가능 |

> **PATH 환경변수 설정 필수 지침:**  
> 시스템 기본 `/bin/sh`의 기본 PATH에 `/workspace/.local/bin` 및 `/workspace/.local/node/bin`이 누락될 수 있으므로, 모든 Node/npm 관련 명령 실행 시 다음 환경변수 주입을 필수로 적용한다:  
> `export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH"`

---

## 2. 저장소(Git) 상태 및 파일 레이아웃

### 2.1 Git 상태 실측
- **저장소 디렉터리:** `/workspace/returnwise_az`
- **현재 브랜치:** `main` (Up to date with `origin/main`)
- **원격 저장소 (origin):** `https://github.com/2010180016y-netizen/returnwise_az.git` (GitHub 공식 연결)
- **최신 커밋:** `f812c4e Add files via upload`
- **작업 트리 상태:** 클린 상태에서 문서 패키지 원본 복사 배치 완료. 기존 커밋 파일 일체 보존.

### 2.2 디렉터리 구조 및 파일 배치
- 원본 패키지(`ReturnWise_AZ_Development_Tickets_Prompts/returnwise_implementation_pack/`)를 100% 보존하면서, 프로젝트 표준 워크스페이스 구조를 위해 루트 디렉터리에 다음 폴더 및 문서를 전진 배치함:
  - `docs/`: 01_PRD ~ 11_EXACT_COPY, TICKET_INDEX.md
  - `docs/implementation/`: 티켓별 검증 보고서 및 환경 문서 저장소 신설
  - `prompts/`: 00_MASTER_PROMPT ~ T40 개별 실행 프롬프트
  - `reports_template/`: 표준 티켓 보고서 템플릿
  - `START_HERE.md`, `ALL_TICKET_PROMPTS.md`, `TICKETS_IMPORT.csv`

---

## 3. 코드베이스 / 빌드 / CI / 호스팅 설정 진단

1. **`package.json` 및 `package-lock.json`:**
   - **현재 상태:** 부재 (Not yet initialized).
   - **조치 계획:** T05(Vite+React+TS 프로젝트 스캐폴드)에서 strict TypeScript, Vite, React, Vitest, Playwright를 정의하여 생성 예정.
2. **테스트 프레임워크:**
   - **현재 상태:** 미설치. T05 및 T06에서 Vitest, Testing Library 설치 예정.
3. **CI / CD 워크플로:**
   - **현재 상태:** `.github/workflows` 부재. T24(CI 품질 게이트)에서 GitHub Actions 워크플로 구축 예정.
4. **호스팅 및 배포 설정:**
   - **현재 상태:** Cloudflare Pages 정적 호스팅 대상. `wrangler` CLI가 `/workspace/.local/bin`에 사전 설치되어 있어 로컬 프리뷰(`wrangler pages dev dist`) 지원 가능.

---

## 4. 재현 가능한 표준 실행 명령

개발 및 검증 시 아래 명령어를 표준으로 사용한다:

```bash
# 환경변수 로드 및 버전 확인
export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH"
node -v
npm -v

# 향후 T05 스캐폴드 후 표준 명령
npm run lint          # ESLint 정적 분석
npm run typecheck     # TypeScript strict 타입 검사
npm test -- --run     # Vitest 단위/통합 테스트 (CI 모드)
npm run build         # Vite 프로덕션 빌드 (출력: dist/)
npx playwright test   # Playwright 브라우저 E2E 테스트
```

---

## 5. 최초 위험 요소 및 차단 요인 (Top 5 이내)

1. **[위험 1 - PATH 환경변수 누락]**: 서브쉘 실행 시 `/workspace/.local/node/bin`이 누락되면 `node: not found` 에러가 발생할 수 있음 → 실행 스크립트마다 명시적 PATH 주입으로 완화.
2. **[위험 2 - 법률·정책 오인]**: 2026-07-21 전자상거래법 시행에 따라, 합의되지 않은 '부분환불'을 최저비용 옵션으로 오인 추천할 경우 법적 리스크 발생 → T02, T03, T08에서 Fail-closed 안전 게이트 엄격 구축.
3. **[위험 3 - 현금지출 vs 순경제적 비용 혼동]**: 회수 상품가치(비현금)를 현금 유출에서 차감할 경우 판매자 의사결정 왜곡 위험 → T02/T03에서 `cashOutflow`와 `economicCost` 엄격 분리.
4. **[위험 4 - 무단 외부 유출 및 PII 수집]**: 브라우저 로컬 기반 MVP 원칙을 위반하고 고객 주문번호/주소 등 PII를 수집하거나 외부로 전송할 위험 → T01, T04, T21에서 브라우저 내부 메모리 격리 및 네트워크 차단.
5. **[위험 5 - 미승인 원격 배포 및 푸시]**: 사용자 명시 승인 없는 GitHub 원격 push 또는 Cloudflare 프로덕션 배포 금지 → 단일 티켓 클릭 승인제 준수.
