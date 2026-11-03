# T18 구현 완료 보고서: FAQ·고지·운영자 표시 페이지

- **티켓 ID**: T18 (FAQ·고지·운영자 표시 페이지)
- **단계**: G2 / 무료 MVP 또는 사업검증 단계 (G2 최종 티켓)
- **선행 티켓**: T12, T02 (`docs/implementation/T12_REPORT.md` PASS, `docs/implementation/T02_REPORT.md` PASS)
- **최종 판정**: **PASS**

---

## 1. 실제 변경 파일 목록

1. `src/content/faq.ts` (신규): 2026 전자상거래법 및 플랫폼 운영 표준 FAQ 9종 (`reviewStatus: APPROVED`, `legalSource` 결속)
2. `src/content/disclosures.ts` (신규): 이용 가이드 4단계, 법률 비자문 면책 고지, 개인정보 처리방침 초안, 이용약관 초안, 및 운영자 정보 (`status: REVIEW_REQUIRED`)
3. `docs/PUBLIC_COPY_REVIEW.md` (신규): 대외 공개 문구 검토 대장 (COPY-01 ~ COPY-08 승인 상태 및 임의 사업자 날조 차단 가드레일)
4. `src/features/calculator/CalculatorPage.tsx` (수정): FAQ 9종 리스트, 이용 가이드 4단계 카드, 법률 면책 고지, 약관/개인정보 처리방침 열람 details, 운영자 정보 및 푸터 내비게이션 결속
5. `tests/integration/disclosures.test.tsx` (신규): FAQ 9종 구조 검증, 운영자 정보 사람 승인 강제 검증, 법률 면책/프라이버시 무결성 검증, CalculatorPage 렌더링 검증 10건
6. `docs/implementation/T18_REPORT.md` (신규): 본 검증 완료 보고서

---

## 2. 구현 핵심 및 안전 계약 준수

### 2.1 특별 안전조건: 운영자 표시 및 개인정보 처리방침 사람 승인 강제
- 실제 법인 및 개인사업자 등록 정보가 확정되지 않은 상태에서 상호, 대표자명, 사업자번호를 임의 날조하여 게시하는 행위를 원천 차단.
- `src/content/disclosures.ts` 내 `OPERATOR_DISCLOSURE.status`를 `REVIEW_REQUIRED`로 고정하고, UI상에 `[사람 승인 대기]` 배지와 안내 문구를 강제 노출.
- `docs/PUBLIC_COPY_REVIEW.md`에 사람 운영자의 서면 승인 필수 절차 명시.

### 2.2 FAQ 9종 완결 (최소 8개 요구조건 초과 달성)
- **Q1 (비용 분리)**: 순경제비용(실제 손익)과 추가 현금지출(자금 유동성)의 차이 및 분리 필요성
- **Q2 (법률 준수)**: 전자상거래법 제18조 제9항에 따른 판매자 귀책 반품비 고객 전가 절대 금지
- **Q3 (부분환불 요건)**: 소비자 자발적 합의, 마켓 약관 허용, 청약철회권 비침해 3대 요건 필수
- **Q4 (교환 권유 제한)**: 환불 요청 고객에 대한 교환 강요 방지 및 사전 동의 의무
- **Q5 (회수가치 평가)**: 반품 재고는 매출이나 순이익이 아닌 순회수가능가액(NRV) 평가 기준
- **Q6 (수수료 환급)**: 플랫폼 판매수수료 확정 환급액 대조 필요성
- **Q7 (특례 품목)**: 신선식품, 맞춤제작, 위생용품 청약철회 제한 및 회수 없는 전액환급 검토
- **Q8 (프라이버시)**: No-PII, 100% 브라우저 로컬 연산, 비민감 기본값 선택 저장 증빙
- **Q9 (비자문 면책)**: 법적 효력이 있는 공인 법률 자문이 아니며 의사결정 참고용 시뮬레이션임을 명시

### 2.3 법률 및 세무 비자문 면책 고지
- 변호사법에 따른 법률 자문이나 세무사법에 따른 세무 자문을 제공하지 않으며, 개별 분쟁 및 약관 해석은 전문가 또는 플랫폼 센터 안내를 받아야 함을 고지.

---

## 3. 실행한 테스트 및 실측 증빙

```bash
$ export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH" && export NODE_OPTIONS="--disable-wasm-trap-handler"
$ cd returnwise_az
$ npm test
# tests 144
# suites 66
# pass 144
# fail 0
# duration_ms 1942.445285

$ npm run typecheck
> tsc --noEmit (0 error PASS)

$ npm run lint
> eslint . (0 error PASS)

$ npm run build
Production build completed successfully: dist/ (assets/index.js 255KB, assets/index.css 9.4KB)

$ grep -rn "react" src/domain/ || echo "NO_REACT_IN_DOMAIN"
NO_REACT_IN_DOMAIN
```

---

## 4. 미검증 및 잔여 위험

- **P0 위험 0건**: 사업자 임의 날조 배제, 사람 승인 대기 고지, FAQ 9종 승인, 법률 비자문 고지, 순수 도메인 격리 100% 검증 완료.
- **E2E 자동화 검증**: T19 티켓에서 모바일/데스크톱 뷰포트(320~1440px) 12개 이상 핵심 사용자 흐름 E2E 테스트를 통해 전수 검증 예정.

---

## 5. 다음 티켓 진행 가능 여부 및 G2 단계 종결

- **G2 UI 개발 단계 완료**: T11부터 T18까지 반응형 1페이지 UI, 폼, 비교 시각화, 상세 산식, 로컬 스토리지, 클립보드 복사, FAQ/고지 모듈이 모두 PASS로 완성되었습니다.
- **진행 가능**: G3 단계의 첫 관문인 **T19(통합 테스트·엔드투엔드 여정)** 티켓으로 즉시 전진 가능합니다.
