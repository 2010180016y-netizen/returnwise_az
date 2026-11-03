# S3 — Cloudflare D1 persistence, tenant auth and verified sandbox billing

- Date: 2026-11-03 (Asia/Seoul)
- Branch: `security/s3-d1-persistence`
- Pull request: https://github.com/2010180016y-netizen/returnwise_az/pull/3
- Base: S1 PR #1 and S2 PR #2 changes, both still pending main merge
- Evidence: https://github.com/2010180016y-netizen/returnwise_az/actions/runs/41585051797
- Latest *code* test evidence before this report commit: **439 tests / 439 PASS / 0 fail**
- TypeScript, ESLint, static frontend build, Worker esbuild, npm high/critical audit: PASS
- No real Cloudflare deployment, no remote D1 migration, no real or test billing request was issued from this work.

## Implemented and verified in CI

1. Additive SQLite/D1 schema with durable order, event, entitlement and session tables.
2. Immutable server-side order binding, fixed sandbox prices, owner-only internal order factory.
3. Atomic D1 `batch` for event insert + monotonic order update + tenant entitlement upsert.
4. Uniqueness constraints and rollback on event replay/duplicate; period-aware anti-regression.
5. Real Node SQLite integration: rollback on conflict, concurrent replay simulation,
   refunded-order terminal state, old-period stale event, cross-tenant isolation,
   expiry behavior, privileged payment proof binding and membership.
6. 256-bit opaque bearer tokens; SHA-256 digest in D1, membership/role/tenant revalidated
   on each request; persistent revocation and owner-only payment confirmation.
7. Disabled-by-default Workers HTTP `/api/pro/` routes. No unverified
   `PAYMENT_STATUS_CHANGED` webhook entitlement route.
8. Provider GET verification of server-initiated sandbox billing result, with
   orderId, paymentKey, mId, amount and status proof before any D1 mutation.
9. Test-only scheduled reconciliation of previously verified payments:
   full/partial cancellation removes entitlement, provider outage does not
   manufacture grants; no cron configured or deployed.
10. Tenant-scoped D1 return-case reads with actual SQL test.

## Critical S2 correction from official Toss documentation

The HMAC signature documented in Toss `tosspayments-webhook-signature`
is emitted for `payout.changed` and `seller.changed`, **not** for
`PAYMENT_STATUS_CHANGED`. Neither is a payment-status webhook sent for
a successful automatic billing approval. S3 has no HTTP handler to trust an
unsigned status notification. The S2 signed-event code is retained only
for synthetic test contracts and is not wired to a production endpoint.

Ref: https://docs.tosspayments.com/reference/using-api/webhook-events

## Release blocking issues (not resolved by CI)

| Item | Status |
|---|---|
| Real Cloudflare staging D1 migration/recovery/transaction tests | NOT PERFORMED |
| Multi-Worker concurrency test against Cloudflare D1 | NOT PERFORMED |
| Real test-store Toss GET / billing-approval response integration | NOT PERFORMED |
| Public, independently verified sign-in / SSO and session issuance | NOT IMPLEMENTED |
| Public Worker API activation, cloud deploy and attached D1 DB | DISABLED |
| Scheduled production reconciliation, alarm routing and retry queue | DISABLED |
| Legacy cases global unique idempotency key migration | OPEN |
| Server-side quotas/API rate limiting and advanced abuse protection | OPEN |
| Real user UAT, legal review, PCI/PG readiness and owner sign-off | OPEN |
| Real/live payment or charge | NOT EXECUTED |

## Verdict

**S3 code and SQLite integration tests: PASS.**
**Production-ready billing and deployed service: BLOCKED.**
Next work should not treat this as a completed commerce launch.
No automated PR merge or real payment setup was performed.
