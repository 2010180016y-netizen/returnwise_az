# 06. 검증 매트릭스

## P0 계산 fixture (KRW)
| ID | 시나리오 | 기대 결과 |
|---|---|---|
| C01 | full 30000, reverse 3500, handling 1000, recovered 9000 | RETURN_FULL cash=34500, economic=25500 |
| C02 | 동일, 회수 없는 전액환급 | KEEP_FULL cash=30000, economic=30000 |
| C03 | 자발적 합의 등 승인된 부분환급 15000 | KEEP_PARTIAL cash=economic=15000 |
| C04 | 부분환급 합의 미확인 | KEEP_PARTIAL 비교·추천 후보에서 제외 |
| C05 | 수수료 환급 확인 1000, 그 밖에 C01과 동일 | RETURN_FULL cash=33500, economic=24500 |
| C06 | 회수가치 0 | cash 변동 없음, economic=cash |
| C07 | 회수가치 10000 증가 | 해당 방식 economic 10000 감소, cash 불변 |
| C08 | 판매자부담 운송비 1000 증가 | 해당 방식 cash/economic 1000 증가 |
| C09 | 고객부담 운송비 3500, 판매자부담 0 | 3500을 판매자 cash에 더하지 않음 |
| C10 | 환불금액 0, 비용 0 | 모두 0(필드가 명시 입력된 경우) |
| C11 | 음수/NaN/Infinity/정수 아닌 원 단위 | 입력 오류, 계산 차단 |
| C12 | 필수 항목 미입력 | 미입력과 0 구별, 결과 계산 차단 |
| C13 | 최대 허용 금액 경계 | 정확히 파싱/계산; 초과 거부 |
| C14 | 이미 발생한 상품매입원가 | RETURN_FULL에 중복 가산하지 않음 |
| C15 | 교환 replacement=12000 reverse=3500 outbound=3000 handling=1000 recovered=9000 | cash=19500, economic=10500 |
| C16 | 고객이 전액 환불 요구/교환 동의 없음 | EXCHANGE 비허용 후보 |
| C17 | 결정적 결과/동일 입력 | 재계산 출력 byte-level 동일(정렬 안정) |
| C18 | 환급금액 30000 + confirmed credit 0/1000 | 해당 방식 cash와 economic 각 1000 차이 |

## 안전/적법성 회귀 최소 8개
L01: 구매자 귀책 미확인 → 법률 추천 금지; L02: 판매자 귀책 → 고객 운임 부담 권유 금지; L03: 부분환불 고객 합의 없을 때 candidate excluded; L04: 플랫폼 허용 불명 → excluded; L05: 권리 비침해 확인 불명 → excluded; L06: 교환 동의 없음 → excluded; L07: 특례 상품 유형 → 전문 검토 필요; L08: 변경 정책 검증 만료 → 안전모드.

## UI/E2E
- 첫 접속/입력/계산/차트&표/문구/복사/초기화/예시/로컬 기본값 복원/비활성 처리/오류/모바일 320px, 375px, 768px, 1440px/키보드/스크린리더 라벨.
- 개인정보 누출: 주소창·localStorage·network 요청·분석도구 payload에 거래/구매자 정보 없음.
- 깨진 링크, favicon, robots.txt, sitemap.xml, noindex 적용 여부 검증.
- fail-closed: 테스트 스위트 실패 시 릴리스 금지.

## 커버리지·CI
단위/통합/E2E를 분리하고 GitHub CI 리포트 저장. 실행하지 않은 테스트는 PASS 기록 금지. 테스트에 목업된 API가 있으면 실제 배포는 별도 검증.
