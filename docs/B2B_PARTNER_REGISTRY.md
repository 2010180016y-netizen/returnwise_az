# ReturnWise B2B 제휴 파트너사 레지스트리 및 라우팅 명세

**문서 버전**: v1.0  
**작성일**: 2026-11-03  
**대상 서비스**: ReturnWise (https://returnwise-az.pages.dev)  
**관리 주체**: 회기님 & 수박

---

## 1. B2B 제휴 파트너사 매핑 대장

| 슬롯 ID | 제휴사명 | 카테고리 | 가치 제안 (셀러 혜택) | 내부 단축 라우트 | 외부 최종 타깃 URL | 정산 방식 및 조건 |
|:---|:---|:---|:---|:---|:---|:---|
| **P01** | **콜로세움 (Colosseum)** | 반품 검수 3PL | 단순변심 B급 상품 재포장, 기능 검수, 당일 재입고 대행 | `/partner/3pl` | `https://www.colosseum.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=return_3pl` | B2B 상담 신청 및 계약 시 CPA 5만~10만원 / 건 |
| **P02** | **박스스토어 (BoxStore)** | 포장재 B2B 도매 | 친환경 에어캡, 안전봉투, 반품 택배상자 대량 공급 | `/partner/packaging` | `https://boxstore.co.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=seller_box` | B2B 사업자 회원 가입 및 결제액 비례 CPS 5%~8% |
| **P03** | **플레이오토 (Playauto)** | 반품 자동화 ERP | 스마트스토어·쿠팡 반품 자동 접수·송장 추적·환불 보류 | `/partner/erp` | `https://www.playauto.co.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=return_automation` | 14일 무료체험 후 유료 플랜 전환 시 20% 리커링 |

---

## 2. Cloudflare Pages 302 리다이렉트 라우팅 (`public/_redirects`)

ReturnWise의 강력한 보안 정책(`connect-src 'none'`) 및 CSP 무결점을 위해, 프론트엔드 React 코드에는 `/partner/*` 단축 경로만 노출하고 Cloudflare Edge 레이어에서 302 HTTP 리다이렉트를 집행합니다:

```apache
# ReturnWise B2B Affiliate partner redirect routes
/partner/3pl https://www.colosseum.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=return_3pl 302
/partner/packaging https://boxstore.co.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=seller_box 302
/partner/erp https://www.playauto.co.kr/?utm_source=returnwise&utm_medium=partner_banner&utm_campaign=return_automation 302
```

---

## 3. 수익 정산 및 링크 커스터마이징 가이드

1. **회기님 고유 파트너스 코드 발급 시**:
   - 추후 각 사 공식 제휴 마케터 또는 쿠팡 파트너스/링크프라이스 B2B 코드가 발급되면, `public/_redirects`의 대상 URL만 회기님 고유 affiliate ID로 교체합니다.
   - 프론트엔드 컴포넌트 재빌드 없이 git push 즉시 엣지 레벨 반영.
2. **트래킹 및 모니터링**:
   - UTM 파라미터(`utm_source=returnwise`)를 통해 파트너사 대시보드에서 ReturnWise 유입 실적 추적.
