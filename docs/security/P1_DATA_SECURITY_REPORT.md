# ReturnWise P1 security/data remediation — implementation and release boundaries

Audit date: 2026-11-03 (Asia/Seoul)
GitHub PR: https://github.com/2010180016y-netizen/returnwise_az/pull/24
Work branch: `security/p1-tenant-data-quotas-integrity`.
Base main: `ac72192afdae33ef79dbeb58b5cab1b8f1a77fc6`.

## 1. Delivered code

| P1 | Original risk | Remediation | Grounded test / source |
|---|---|---|---|
| P1-01 | cases.idempotency_key UNIQUE globally, blocking identical keys across organizations | Forward-only 0005: rename old cases to cases_legacy_p1, create cases with UNIQUE(tenant_id,idempotency_key) and copy every historic row | tests/security/p1_d1_security.test.ts |
| P1-02 | SQL policy_verified DEFAULT 1 silently treated unreviewed records as legal consent | New cases policy_verified INTEGER DEFAULT 0 CHECK(0/1); ALL legacy rows re-imported as REVIEW_REQUIRED, policy_verified=0, baseline_economic_cost=NULL | migration test and Worker read masking |
| P1-03 | Deleted records restored from stale backups, idempotency key replay | Durable case_tombstones table keyed tenant/caseId with additional tenant/idempotencyKey unique index; INSERT, UPDATE, DELETE triggers block resurrection/reuse. CaseService restore ignores deleted/expired/newer snapshots and revokes inherited attestation | tests/security/p1_d1_security.test.ts and cases_lifecycle.test.ts |
| P1-04 | Legacy quota guard accepts caller's plan and usage, no transactional counters | D1 quota_usage + quota_reservations + BEFORE/AFTER INSERT triggers charge rows exactly once within atomic D1 batch. Server entitlement and valid member/session revalidated, per-tenant/month counters and request-ID replay detection | server/usage/d1Quota.ts + p1 tests |
| P1-05 | Paid quota view / case GET unsafe defaults | Authenticated GET /api/pro/quota test-only read view; NEVER exposes unchecked public reservation POST. Worker SELECT masks options/baselines until policy_verified=1 | server/worker/index.ts |
| P1-06 | Manifest contains nonexistent S6 commit SHA and fictitious PASS proof strings | Correct F01/F02 source URLs to actual merged commit ac72192a and completed main Actions 41611527619 (498 Node/60 browser tests). Validate canonical evidence URLs, commit existence in full-history Actions checkout | scripts/s6_release_preflight.mjs; CI checkout fetch-depth=0 |
| P1-07 | Historic billing/staging audit reports overstate live validation | Prepend superseding disclaimers in S6-10, S6-14, S6-15 reporting files | docs/s6_evidence/*.md |

## 2. Data migration contract — 0005

File: `db/migrations/0005_p1_tenant_cases_quota.sql`.

- **No remote database has been modified.** This migration is source-controlled but has NOT been applied to Cloudflare D1.
- Migration sequence remains 0001 → 0002 → 0003 → 0004 → 0005. The P0 `npm run check:migrations` safety gate executes the full SQL locally and forbids destructive DROP/DELETE statements in the automatic directory.
- Table `cases_legacy_p1` remains as a preserved historical copy. **Do not drop or publish it** until privacy/retention/restore signoff. A future production migration/cleanup requires independent authorized review.
- Every legacy case is copied to new `cases`, but prior policy verification flags are **reset to 0** and recommendation codes to `REVIEW_REQUIRED` for fail-closed safety. The user needs independent re-attestation before those cases can produce verified recommendations.
- Prior baseline savings are marked NULL and must never be silently re-used.
- Case and reservation rows enforce tenant scoping in SQL. Existing backup snapshots are not inherently authoritative; deletion tombstones take precedence.
- The SQL migration requires a **verified staged backup, controlled replay against a copy of the real data, integrity counts, referential checks, and a restore rehearsal** before any remote apply.
- CaseService remains an in-memory/legacy boundary, **not** a replacement for a persistent D1 write API. New persistent deletion protections are in the D1 schema; no production case-create/delete HTTP endpoint was enabled.

## 3. D1 quota safety contract

- STARTER: 100 rows / KST month. PRO: finite operational safety ceiling 100,000 rows / KST month (not marketed as uncapped billing). Max 1,000 rows per reservation.
- Entitlement status must be ACTIVE in D1 and in its valid billing period. Session hash, user membership, tenant status, role, revocation and expiry are rechecked on the server.
- `quota_reservations` uses UNIQUE(tenant_id,request_id). Concurrent duplicate calls do not double-charge rows; different payload with reused requestId returns a conflict. SQLite triggers atomically reject over-cap INSERT.
- This internal service is **NOT YET wired to an authenticated Pro batch ingestion/job executor**. It must be called only as part of an actual authorized server-side batch job once that feature exists. Until then, usage-reservation POST API is deliberately absent.
- For Pro staging, test with multiple genuine concurrent Workers against Cloudflare D1, not only the Node SQLite simulator.

## 4. Evidence and automated verification

- All existing CI quality gates and new tests are run using the GitHub Actions PR workflow, including typecheck, lint, production build, Worker ESM, D1 migrations via SQLite, Node tests, high/critical npm audit, Playwright Chromium/Firefox/WebKit desktop and mobile emulation.
- Source-repo manifest is **not** a human signature. Github commit ancestry checks in CI reject fabricated Git proof SHA, but external legal/operational approvals remain independently required.
- Latest successful PR and merged-main CI URLs must be recorded in the PR description/merge response. Do not infer test pass from a newly created commit.

## 5. Remaining release blockers (NOT resolved by P1)

1. Cloudflare D1 remote backup, 0005 migration, multi-worker concurrency, restore, historic legacy retention cleanup — NOT tested.
2. Real verified login/session issuance and passwordless/OAuth recovery, real tenant consent and privacy notices — NOT implemented.
3. Public authenticated Pro batch upload, server-side job orchestration, quota reservation/commit/cancel, rate limiting, deleted-data purge and billing handoff — NOT operational.
4. Toss payment merchant sandbox / signed authentication model / refund reconciliation — NOT externally verified; live billing disabled.
5. Physical-device UAT, seller UAT, actual business contact, legal approval, rollback rehearsal — independently pending.
6. GitHub main branch protection/rulesets: owner/admin must configure required CI + review; no admin settings changed by this PR.

**Decision:** P1 source-code hardening can pass automated review, but **FREE and PRO public launch permissions are not granted**. Release gates F03-F09 and P01-P08 remain pending/blocked exactly as in the evidence manifest.
