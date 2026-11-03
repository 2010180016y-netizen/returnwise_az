# Public Copy & Operator Disclosures Review Register (docs/PUBLIC_COPY_REVIEW.md)

> ReturnWise 대외 공개 문구, 법률 고지 및 사업자 정보 검토 대장
> 최종 업데이트: 2026-11-03 KST
> 원칙: 사실관계 미확인 문구는 배포 전 반드시 `REVIEW_REQUIRED`로 유지하며, 사람 운영자의 최종 승인 없이 실제 사업자 정보를 임의 작성하지 않는다.

---

## 1. 대외 공개 문구 검토 상태표

| 항목 ID | 문서/섹션 | 내용 요약 | 현재 상태 | 승인자 / 비고 |
|---|---|---|---|---|
| COPY-01 | `CalculatorPage` Hero | "반품 한 건, 실제로 얼마가 더 들까요?" AEO/헤드라인 문구 | **APPROVED** | UX 팀 승인 완료 |
| COPY-02 | `src/content/faq.ts` | FAQ 9종 전수 (2026 전자상거래법, 비용 분리, 특례품목 등) | **APPROVED** | 법무/운영 검토 완료 |
| COPY-03 | `src/content/glossary.ts` | 6대 금융/법률 용어사전 (회수가치 매출/이익 표현 배제) | **APPROVED** | 재무/법무 검토 완료 |
| COPY-04 | `LEGAL_DISCLAIMER` | 법률 및 세무 비자문 면책 조항 | **APPROVED** | 컴플라이언스 승인 완료 |
| COPY-05 | `PRIVACY_POLICY` | 개인정보 미수집, 100% 로컬 연산, 트래커 0건 증빙 | **APPROVED** | 개인정보보호 책임자 승인 완료 |
| COPY-06 | `TERMS_OF_SERVICE` | 무료 유틸리티 이용약관 초안 | **APPROVED** | 서비스 운영팀 초안 승인 완료 |
| COPY-07 | `OPERATOR_DISCLOSURE` | 사업자등록번호, 통신판매업번호, 상호, 대표자명, 사업장소재지 | **REVIEW_REQUIRED** | **사람 운영자 서면 승인 대기** (임의 게시 금지) |
| COPY-08 | 문의 창구 이메일 | 공식 고객 지원 이메일 | **REVIEW_REQUIRED** | 도메인 MX 레코드 설정 후 사람 승인 필요 |

---

## 2. 특별 안전 가드레일 (Special Safety Conditions)

1. **임의 사업자 정보 날조 절대 금지**:
   - 실제 사업자등록증 또는 법인 등기부등본이 확인되지 않은 상태에서 상호, 대표자, 사업자등록번호를 임의로 작성하여 공개 배포하는 행위를 엄격히 차단한다.
   - `src/content/disclosures.ts`의 `OPERATOR_DISCLOSURE.status`가 `APPROVED`로 변경되기 전까지는 UI에서 `[사람 승인 대기]` 플레이스홀더를 강제 노출한다.

2. **개인정보 처리방침 사람 최종 승인**:
   - 현재 ReturnWise는 No-PII 및 100% 로컬 스토리지 아키텍처로 개인정보를 수집하지 않으나, 향후 호스팅(Cloudflare Pages 등)의 서버 로그 수집 범위나 도메인 연결 시 실제 운영 형태에 맞춰 사람 관리자의 최종 서면 검토를 거쳐야 한다.

3. **법률 자문 오인 방지 강제**:
   - 모든 대외 공개 페이지와 복사 리포트 푸터에 "변호사법상 법률 자문이나 세무 자문이 아니며 의사결정 참고용 시뮬레이션임"을 명시한다.
