# ReturnWise 롤백 지점 및 복구 매뉴얼 (ROLLBACK_POINT.md)

- **제품명**: ReturnWise (반품·환불·교환 비용 비교 계산기)
- **릴리스 버전**: v0.1.0 (Phase 1 무료 MVP)
- **기준 일시**: 2026-11-03 10:35 KST
- **관리 목적**: 프로덕션 배포 시 예상치 못한 결함이나 장애 발생 시 즉각적으로 안전한 이전 상태로 원상 복구하기 위한 절차 명세

---

## 1. 롤백 기준점 (Rollback Baselines)

| 구분 | 식별자 / 지점 | 상태 설명 |
|---|---|---|
| **베이스라인 커밋 (Pre-Release)** | `f812c4e9fa6ae0c08b8420ad611052a2b970bcd2` | T00 착수 직전 저장소 초기 상태 |
| **G3 품질 게이트 완료 지점** | G3 PASS (218 Tests PASS) | T24 CI 품질 게이트 완료 커밋 |
| **v0.1.0 프로덕션 릴리스 지점** | v0.1.0 Release Candidate | T27 프로덕션 번들(`dist/`, 234 Tests PASS) |

---

## 2. 장애 시나리오별 즉각 롤백 절차

### 시나리오 A: Cloudflare Pages 호스팅 장애 또는 배포 이상 시
1. **Cloudflare 대시보드 접속**: `Cloudflare Dashboard` -> `Workers & Pages` -> `returnwise` 프로젝트 선택.
2. **배포 내역 확인**: 상단 `Deployments` 탭으로 이동.
3. **이전 정상 배포 롤백**:
   - 목록에서 직전 정상 배포 항목 우측의 `...` 메뉴 클릭.
   - `Rollback to this deployment` 선택 및 확인.
   - 10초 이내에 엣지 네트워크에서 이전 빌드 결과물로 즉시 롤백 완료.

### 시나리오 B: Git 저장소 소스코드 롤백 필요 시
```bash
# 1. 릴리스 커밋을 안전하게 취소하는 리버트 커밋 생성 (협업 브랜치 권장)
$ git revert HEAD --no-edit

# 2. 또는 특정 베이스라인 커밋으로 하드 리셋 (필요 시)
$ git reset --hard f812c4e9fa6ae0c08b8420ad611052a2b970bcd2

# 3. 빌드 재실행 및 무결성 확인
$ npm run build && npm test
```

---

## 3. 롤백 후 안전 상태 검증 체크리스트

롤백 실행 직후 다음 4개 항목을 즉시 점검합니다:

- [ ] **HTTP 200 정상 응답**: 루트 URL(`/`) 접속 시 화이트아웃 없이 정상 로드되는지 확인.
- [ ] **보안 헤더 작동**: `curl -I https://returnwise.pages.dev` 실행 시 `Content-Security-Policy: connect-src 'none'` 유지 확인.
- [ ] **스토리지 및 PII 격리**: 브라우저 로컬 스토리지에 잔여 PII나 오염된 키가 없는지 확인.
- [ ] **검색엔진 상태**: `sitemap.xml` 및 `robots.txt`가 정상적으로 루트 페이지만 가리키는지 확인.
