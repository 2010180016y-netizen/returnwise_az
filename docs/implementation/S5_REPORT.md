# S5 — Real Browser E2E, Mobile Accessibility & Local CSV UX

- Date: 2026-11-03 (Asia/Seoul)
- Work branch: `qa/s5-browser-e2e`
- Review: https://github.com/2010180016y-netizen/returnwise_az/pull/5 (draft)
- Parent: pending S1 PR #1, S2 PR #2, S3 PR #3, S4 PR #4; main not updated.
- **Verified code baseline:** `d88266ce1aa4917bebacbec1e2918178d1050578`
- **GitHub Actions evidence:** https://github.com/2010180016y-netizen/returnwise_az/actions/runs/41590965610
- **Code/Node security suite:** 477 tests / 477 PASS / 0 FAIL.
- **Real browser suite:** 24 Chromium cases / 24 PASS / 0 FAIL.
- TypeScript, lint, esbuild production build, Worker ESM bundle and npm audit: PASS.
- No Cloudflare deployment, remote D1 mutation, live payment, or real customer CSV processed.

## Confirmed problems and remediation

| ID | Finding | S5 change | Evidence |
|---|---|---|---|
| S5-01 | esbuild generated `dist/assets/index.css` but `index.html` failed to load it | Insert link and assert CSS output exists | Real computed body style and stylesheet link verified |
| S5-02 | Policy and statutory-rights flags were mandatory yet had no UI controls | Add explicit accessible checkboxes | Chromium interaction verifies recommendation remains closed until both checked |
| S5-03 | Example presets silently set policy and rights to true | All example legal/consent flags now default false | Browser tests prevent pre-approved recommendations |
| S5-04 | CSV parser existed only as back-end logic, no actual upload journey | Client-only `LocalCsvPreview`: file selection, validation summary, PII warning, 15-row preview, allowlisted CSV download | Real browser file upload and browser download verified |
| S5-05 | Mobile header/container could overflow | CSS responsive wrapping; retain table-local scrolling | Chromium 320px/Pixel 5 viewport overflow check |
| S5-06 | Disabled cards used whole-card opacity causing unreadable labels | Remove opacity and darken secondary/danger text colors | axe WCAG 2.x A/AA desktop/mobile PASS |
| S5-07 | Horizontally scrollable result and CSV tables were not keyboard-focusable in mobile | `tabIndex=0`, labeled `role=region` | axe `scrollable-region-focusable` PASS on mobile |
| S5-08 | No authentic browser test gate | Separate Playwright+axe Chromium desktop/mobile GitHub Actions job | Full browser run green in Actions |

## Real user journeys checked (12 distinct scenarios x desktop/mobile)

1. Production HTML loads actual CSS and the calculator UI.
2. Default fail-closed policy/rights state, example values, explicit confirmations,
   correct 25,500 KRW example cost, metric switch and reset.
3. Invalid required amount announces error and suppresses recommendation.
4. 320px/mobile document width does not horizontally overflow.
5. Seller-only non-sensitive defaults require consent, persist, reload and delete.
6. Copy action provides accessible success or manual textarea fallback.
7. CSV file select, row-specific error count, REVIEW_REQUIRED and ERROR,
   sanitized downloadable result, clear/reset.
8. Complete user-attested CSV produces only `ESTIMATE_ONLY` with safeguards.
9. PII source columns never appear in UI output or outbound requests.
10. Malformed CSV surfaces generic accessible alert and keyboard navigation works.
11. Full rendered production DOM passes automated axe WCAG A/AA rules.
12. CSV error/preview DOM also passes automated axe WCAG A/AA rules.

## Reproduce locally

```bash
npm ci
npm run build
npm install --no-save --package-lock=false @playwright/test@1.64.1 @axe-core/playwright@4.14.0
npx playwright install --with-deps chromium
npm run test:browser
```

Playwright's `webServer` launches `vite preview` against the actual
`dist/` production bundle on `127.0.0.1:4173`. Test projects are
`chromium-desktop` and `chromium-mobile` (Pixel 5 emulation).
GitHub Actions stores an HTML report, screenshots and traces in
`returnwise-s5-browser-evidence` for seven days.

Official Playwright documentation:
- https://playwright.dev/docs/ci
- https://playwright.dev/docs/test-webserver
- https://playwright.dev/docs/accessibility-testing

## Important limitations and outstanding release blockers

- Chromium mobile emulation **is not** a physical iPhone/Android test.
  Safari/WebKit, Firefox, real devices and screen-reader manual verification
  were not performed.
- axe-core automated checks do **not** certify all WCAG criteria; manual
  user testing of keyboard, zoom, focus, narration and color contrast is needed.
- Browser CSV is a local *preview only*, not the production authenticated Pro
  ingestion pipeline. No server upload/storage, D1/R2 integration, purchase,
  external submission, automatic refund or legally certified recommendation.
- PII could exist transiently in a source CSV that a user picks. The UI warns
  users not to select source customer CSVs; parser drops non-business columns
  before preview results and exports.
- S1–S4 branches remain open and unmerged; final human code review, dependency
  merge and CI rerun on integrated main are still required.
- S3 remote D1 transactions, payment gateway staging, billing reconciliation,
  verified login issuance and real Pro usage/quotas are still BLOCKED.
- S6 must finish real operator review, privacy/legal texts, customer UAT,
  staging deployment security and final Go/No-Go.

## Verdict

**S5 automated browser and existing code gates: PASS.**
**S5 production/public Pro go-live: NOT APPROVED.**
No hidden assumption or test count should be used as a legal or commercial guarantee.
