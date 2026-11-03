# ReturnWise — independent source audit and remediation register

Date: 2026-11-03 (Asia/Seoul)
Scope: GitHub `main` @ `12a1311d12fa1683dd80f3be728a28f3c9c6b30e` vs PR #1.
Important: The presence of 41 implementation reports is **not** equivalent to independently verified completion of all T00–T40 acceptance gates.

## Independent evidence

- Repository had 41 ticket report files and functioning React/TS code; no active workflow at `.github/workflows/` on base main.
- `docs/ci-workflow.yml` was not loaded by GitHub Actions. The actual workflow has now been added.
- PR #1 CI runs: typecheck, ESLint, esbuild build, Node test suite, npm audit; documented successful run with 402 tests / 402 passed at commit `1c511de`.
- Tests under `tests/e2e/` are mostly Node `node:test`/server-side render/static contract checks, not Playwright browser journeys. **No independent browser E2E pass.**
- Verified runtime security and legal conclusions cannot be inferred from a successful unit-test counter.

## Severity-ordered findings

| ID | Severity | Finding and reproducible code evidence | State | Fix / next gate |
|---|---|---|---|---|
| RW-01 | P1 | CI exists only in `docs/ci-workflow.yml`; zero workflow runs on base main | FIXED IN PR | `.github/workflows/ci.yml` + real PR Actions green |
| RW-02 | P0 | `src/domain/eligibility.ts`: `policyReviewed=false`, `rightsReviewed=false` or platform OTHER did not remove eligible recommendation | FIXED IN PR | Global fail-closed eligibility |
| RW-03 | P0 | `src/features/calculator/useCalculatorState.ts`: policy/rights checks pre-selected on first visit; invalid amount inputs could still flow to cost comparison | FIXED IN PR | Default unchecked + suppress recommendation |
| RW-04 | P0 | `server/batch/batchProcessor.ts`: fabricated salvage 30%, product cost 50%, partial refund 30%; `sortedAlternatives[0]` bypassed customer consent and policy gates | FIXED IN PR | No assumed recommendation; REVIEW_REQUIRED and null costs |
| RW-05 | P1 | `src/domain/eligibility.ts`: seller-fault buyer-charge may leave alternative KEEP_FULL recommendable; invalid/zero/full partial-refund amounts could rank | FIXED IN PR | Hard blocks and new regression cases |
| RW-06 | P1 | `server/batch/csvSanitizer.ts`: formula dangerous prefix short-circuited RFC CSV quoting | FIXED IN PR | Normalize then escape; regression tests |
| RW-07 | P1 | `server/cases/caseService.ts`: `policyVerified ?? true` silently asserts approval; expired case readable before purge | FIXED IN PR | Default false / unverified recommendations blocked, 404 expired |
| RW-08 | P1 | `scripts/run-tests.mjs`: no discovered tests returned success | FIXED IN PR | exit 1 |
| RW-09 | P1 | `scripts/build.mjs`: stale dist output and missing index entry marker could ship bad build | FIXED IN PR | clean dist, fail when marker absent |
| RW-10 | P0 (Pro) | `server/billing/billingService.ts`: exported `handleTossWebhook` can accept DONE and activate plan without forcing signature+provider payment lookup/order/amount/mId/status/tenant verification; in-memory processed events cannot guarantee distributed idempotency | OPEN — PRO BLOCKER | Implement trusted webhook adapter, provider API lookup, durable event ledger, real API tests; no production billing |
| RW-11 | P0 (Pro) | `server/auth/session.ts`, `server/cases/caseService.ts`, `server/billing/billingService.ts` rely on in-memory sets/maps rather than D1/Workers API bindings; tenant verification and revocation not durable | OPEN — PRO BLOCKER | Actual deployed auth, D1 repositories, migrations, tenancy isolation, durable revocation |
| RW-12 | P1 (Pro) | `db/migrations/0002_cases_schema.sql` has globally UNIQUE `idempotency_key`, potentially conflicting across tenants | OPEN | Composite unique (tenant_id, idempotency_key) with migration plan + SQL integration tests |
| RW-13 | P1 | `src/features/batch/csvParser.ts` uses `Number`/floors invalid numeric values; naïve row splitter cannot safely handle quoted multiline data | OPEN | Finite safe numeric validation, strict CSV parser, malicious fixtures, controlled errors |
| RW-14 | P1 | No real browser Playwright or axe run despite README referring to Playwright and WCAG AA certification | OPEN | Install browser runner, actual input/submit/focus/viewport tests and axe audit |
| RW-15 | P1 | `public/_headers` CSP `connect-src 'none'` is compatible with static calculator but incompatible with hypothetical Pro API connections | OPEN (Pro) | Design per-environment CSP only after actual API routes exist |
| RW-16 | P1 | Market policy & legal-review flags are self-reported booleans; site cannot certify legal permissibility | OPEN (human validation) | Official sources, store-policy checks, qualified legal review and UAT signoff |
| RW-17 | P1 (business) | T29–T32 reports/templates are not proof of completed seller interviews or real paid demand | OPEN | Real consented interviews, measured retention/conversion and explicit Go/No-Go |
| RW-18 | P2 | README claimed Vite 5, Vitest/Playwright, when actual dev stack was Vite 6, esbuild/node:test; local preview required undeclared wrangler | FIXED IN PR | Accurate README; `vite preview` |
| RW-19 | P2 | CI logs include React ErrorBoundary setState-on-unmounted warning and deprecated Node API warnings | OPEN | Reproduce and remove unsafe error-boundary effect; upgrade affected toolchain |

## Next sequential tickets

1. **S1 — Complete PR #1 / CI proof.** Confirm all job steps and test count, review changes, no automatic merge.
2. **S2 — Pro billing hard gate (P0).** Design webhook verification grounded in official Toss Payments docs; signature **and** independent provider lookup and merchant/order/amount/status binding. Reject every unverifiable event; never expose an unauthenticated call to the internal apply state function.
3. **S3 — Real Pro persistence/authorization (P0).** Deploy D1/Workers routes, migrations, tenant-scoped queries, revocation and event deduplication; prove cross-tenant rejection and backup/restore.
4. **S4 — CSV input hardening (P1).** Proper parse, no magic commission, finite safe integer constraints, PII stripping and injection tests.
5. **S5 — Actual browser E2E (P1).** Playwright keyboard/mobile/interactive/copy/storage scenarios, axe and no-console-error gate.
6. **S6 — Owner legal/UAT, commercial gate (P1).** Real user validation; only then consider public MVP/Pro launch.

## External authoritative integration requirement

Toss Payments official security checklist:
https://docs.tosspayments.com/reference/using-api/security-checklist

It requires webhook signature verification and independent payment lookup checks for orderId/totalAmount/mId/status. A standalone HMAC helper is not sufficient. No live credentials, payments or deployments were used in this audit.

## Decision

- **Free static calculator:** engineering regression tests green on PR branch; needs real browser E2E, human policy and deployment acceptance before PUBLIC_READY.
- **Paid Pro:** **NOT PRODUCTION READY** due RW-10 and RW-11.
- **Current main:** remains unchanged pending review/merge of PR #1.
