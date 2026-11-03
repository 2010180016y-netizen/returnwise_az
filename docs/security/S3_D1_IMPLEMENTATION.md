# ReturnWise S3 Workers + D1 — Implementation & Deployment Safety

Date: 2026-11-03. Branch `security/s3-d1-persistence`.
**Status:** S3 code/integration tests in progress; NO Cloudflare remote deployment,
NO Toss real payment, NO production D1 mutation.

## Important correction of S2's webhook assumption

Toss official webhook documentation specifies `tosspayments-webhook-signature`
for **`payout.changed` and `seller.changed` only**, not for ordinary
`PAYMENT_STATUS_CHANGED`. Its `PAYMENT_STATUS_CHANGED` also does not signal
automatic billing approvals. A signed-v1 payment-status route would be
nonfunctional and must NOT be used as evidence of payment security.

For ReturnWise subscription rights, server-initiated payment responses must
be independently queried using Toss `GET /v1/payments/{paymentKey}` and
cross-checked against an immutable server-created order. S3 exposes NO
unsigned webhook entitlement mutation endpoint.

Official sources:
- https://docs.tosspayments.com/reference/using-api/webhook-events
- https://docs.tosspayments.com/reference/using-api/security-checklist
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/sql-api/foreign-keys/

## Data model

`db/migrations/0003_s3_billing_persistence.sql` is additive:
- `billing_orders`: immutable order amount/plan/merchant/period and monotonic rank
- `billing_events`: replay-resistant event history with unique order/payment/status
- `billing_entitlements`: last effective tenant entitlement, monotonic per period
- `billing_sessions`: SHA-256 digests of opaque 256-bit session tokens and revocation

Legacy `subscriptions`, `return_sessions` and `cases` are not silently migrated.
S3 schema requires existing `tenants` and `users`. Production migration must
be performed by a human, in a new preview D1 DB after backup and manual review.

## Atomic D1 transactions

`createD1BillingLedger` uses a D1 `batch()`:
1. Insert event only if immutable DB order matches tenant/amount/mId/plan/period.
2. Conditional forward-only order state update (PAST_DUE 1 / ACTIVE 2 / REFUNDED 3).
3. Upsert tenant entitlement only when the order's `last_event_key`
   reflects a valid transition and subscription period is not superseded.
On unique constraint errors the entire batch rolls back; duplicates are read
back and classified. Stale order events may be logged for audit but never
downgrade or grant a newer tenant subscription. A new month is a new order.

No external billing charge is issued by `confirmTrustedPayment`; it only
verifies an already-issued test payment and records its status.

## Durable authentication and tenant access

- `registerTrustedSession` is an **internal function only** that MUST be called
  after separately verified sign-in (future magic-link / SSO integration).
  This release **has no public account creation or session-mint route**.
- 256-bit random bearer tokens are hashed (SHA-256) before D1 persistence.
- Every authenticated Worker request reads the session hash, expiry,
  revocation, tenant and user membership from D1.
- The HTTP request cannot supply an authoritative tenant ID or plan.
- `/api/pro/entitlement`, `/api/pro/cases` use that trusted tenant.
- `/api/pro/verify-payment` is owner-only, sandbox-only, and only performs
  provider verification; never initiates payment.

## Server endpoints

- `GET /api/health`: no secret or operational configuration exposed
- `POST /api/webhooks/toss`: **410 disabled** (unsupported/unsigned)
- `GET /api/pro/entitlement`: bearer + D1 membership + current period
- `GET /api/pro/cases`, `GET /api/pro/cases/:id`: bearer + active plan + tenant
- `POST /api/pro/logout`: persistent session revocation
- `POST /api/pro/verify-payment`: owner-only; server-side Toss test GET;
  orderId/paymentKey must correspond to the same tenant and stored order

All private endpoints return 503 unless `BILLING_MODE=test` and
`S3_TEST_ONLY=yes`. Live mode is deliberately unsupported; no public
deployment should be performed before remaining gates.

## Setup (DO NOT execute remotely without explicit authorization)

1. Provision *separate* sandbox D1 manually; never reuse production.
2. Review migrations; run on scratch SQLite/D1 local, then only the sandbox D1.
3. Copy `wrangler.s3.example.toml` to private `wrangler.toml` with real
   database ID; keep `workers_dev=false` and **do not add public routes**.
4. Add `TOSS_TEST_API_SECRET` via `wrangler secret put` in a secure environment.
5. Do not store any real secret, payment key, access token or raw webhook in git.
6. Obtain real **test** merchant ID (mId) and check returned payment GET fields.
7. Integrate verified authentication through a dedicated provider workflow.
8. Confirm actual Cloudflare D1 `batch()` behavior under concurrent requests.
9. Validate ledger reconciliation, restoration, privacy deletion and monitoring.
10. Only after external legal/PG review and owner sign-off discuss live billing.

## Remaining S3+ gates

- Real Cloudflare D1 remote/staging tests, Workers bundling + deployment review.
- Magic-link/SSO login including verified session issuance and recovery.
- Provider test integration; independent payment lookup and billing-charge response.
- Subscription reconciliation cron/job and partial-cancellation entitlement policy.
- Real multi-worker simultaneous writes (SQLite integration tests alone are not enough).
- Legacy `cases` unique idempotency key migration, quota enforcement with D1.
- Rate limiting, audit logging, telemetry, DR backup/restore and runbook.
- Accessibility, browser E2E and legal human approval.

**No claim of S3 production readiness is valid until these gates pass.**
