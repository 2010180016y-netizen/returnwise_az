# S2 — Toss Payments verified billing security boundary

Date: 2026-11-03 (Asia/Seoul)
Target: ReturnWise Pro; implementation is SANDBOX-ONLY / NO LIVE BILLING.

## Verified official provider requirements

- Webhook HMAC: `HMAC-SHA256(rawBody + ':' + transmissionTime, webhookSecurityKey)`.
- Header: `tosspayments-webhook-signature: v1:<base64>[,v1:<base64>...]`.
- Transmission header: `tosspayments-webhook-transmission-time` is signed input.
- `tosspayments-webhook-transmission-id` changes on delivery; DO NOT use for dedup.
- `eventId` may be omitted on `PAYMENT_STATUS_CHANGED`; use a durable
  fallback and verify the payment against provider.
- Retrieve Payment via server-side Toss GET and compare `orderId`, `totalAmount`,
  `mId`, `status`, `paymentKey` with internal created order.
- Automatic billing does NOT emit payment-status-changed when it approves a charge:
  billing responses must be verified and committed separately in S3.
- Respond to webhook within 10 seconds; S3 must design durable queue/retry and
  HTTPS ingress before enabling route; never acknowledge loss as success.

Primary sources:
- https://docs.tosspayments.com/reference/using-api/webhook-events
- https://docs.tosspayments.com/reference/using-api/security-checklist
- https://docs.tosspayments.com/reference
- https://docs.tosspayments.com/guides/v2/webhook

## Modified implementation

1. `server/billing/billingService.ts` — signature + log redaction only.
   The old unauthenticated `handleTossWebhook(payload, tenantId, plan)`,
   `saveSubscription`, `applySubscriptionUpdate` and global in-memory entitlement
   store have been REMOVED. No arbitrary DONE notification can grant Pro via them.
2. `server/billing/verifiedBilling.ts` — strict, signed and independently
   verified processing: parse event, resolve server-owned order, fetch provider
   proof, cross-check merchant/order/amount/paymentKey/status, then issue an
   atomic ledger command. No caller-provided tenant/plan or billing period accepted.
3. `server/billing/tossPaymentLookup.ts` — server-side test-key-only GET to
   fixed Toss host, explicit status and shape validation, no live keys.
4. `tests/billing/webhook_security.test.ts` — signature-forgery, mismatched
   payment evidence, test-only activation, duplicate/replay, cancellation and
   provider-outage cases. All provider requests are mocked in CI.

## S2 security guarantees and limits

- No production HTTP route is registered by S2. It is a verified business
  boundary for future integration and cannot collect a real charge.
- The processor hard-rejects LIVE mode and requires an explicit sandbox flag.
- The ledger is an **interface only**. CI uses an in-memory deterministic test
  double. It is NOT proof of production durability or concurrent Worker safety.
- `processVerifiedBillingWebhook` does not accept arbitrary tenant/plan as
  parameters; trusted tenant and plan come from the stored order.
- If provider lookup errors, signature invalid, merchant mismatched, order unknown,
  amount wrong or status stale: no entitlement write occurs.
- `PARTIAL_CANCELED` revokes paid eligibility conservatively. Before
  production S3 must define proration, partial cancellation and multi-period
  subscription semantics with actual PG receipts.
- Server-side secrets remain unmapped; no Toss API key or webhook security key
  is stored in GitHub.
- In-app `server/usage/quotaGuard.ts` still accepts a plan argument.
  S3 MUST derive it exclusively from trusted server-side subscription state.

## Mandatory S3 durable ledger contract (before launch)

Atomic transaction must:
1. Read immutable server-created order by `order_id`.
2. Confirm tenant, amount, mId and expected payment binding.
3. Insert a dedup event key with unique index; for missing `eventId` use
   deterministic hash of event type, createdAt, payment key and status.
4. Enforce duplicate suppression by `(order_id, payment_key, status)`, not
   event key alone.
5. Reject regressions: refunded/canceled order cannot become active again from
   an older event. A new period needs its own new order/payment proof.
6. Apply payment state, entitlement status and period from trusted order
   in ONE atomic durable transaction; retry conflict safely.
7. Record audit metadata without raw tokens, card data, raw webhook secrets.
8. Reconcile delayed/refund events from the authoritative payment lookup.
9. Do NOT rely on in-memory `Map`/`Set` for multi-Worker safety.

## Launch blockers / owner actions

- Deploy trusted HTTPS webhook ingress, durable event queue and D1 adapter (S3).
- Add verified server-initiated recurring billing response flow (NOT webhook only).
- Implement subscription revocation and authoritative server-side quota checks.
- Run real Toss **test** integration, replay/retry and multi-worker concurrency.
- Confirm merchant ID and API/security-key binding, partner contract and policy.
- Owner legal review, refund policy, tax invoicing, customer service, final signoff.
- LIVE mode must remain disabled until these gates are independently passed.

## Acceptance

S2 source and sandbox mock tests can pass while Pro remains **NOT PRODUCTION READY**.
No author should mark the Pro launch/PCI/security gate PASS solely from Node tests.
