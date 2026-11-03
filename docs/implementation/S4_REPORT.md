# S4 — CSV Batch Parser & Decision Security: Implementation Result

- Date: 2026-11-03 (Asia/Seoul)
- Work branch: `audit/s4-csv-hardening`
- Pull request: https://github.com/2010180016y-netizen/returnwise_az/pull/4 (draft)
- Base: includes pending S1 #1, S2 #2 and S3 #3; merge in dependency order
- Evidence: https://github.com/2010180016y-netizen/returnwise_az/actions/runs/41586850777
- Verified S4 CI: **477 tests, 477 passed, 0 failed**
- Strict TypeScript, ESLint, esbuild frontend, S3 Worker bundle, npm audit all passed.
- No real account PII uploaded, no external payments, no production deployment, no PR merge.

## Changes

1. `src/features/batch/csvParser.ts`:
   RFC-style CSV scanner supports embedded multiline quoted cells, escaped quotes,
   commas, CRLF/LF; rejects unclosed/malformed quoted values, mismatched rows and
   duplicated aliases. Fatal UTF-8 byte decoder + optional BOM, 5 MiB/1000 logical
   rows/64 cols/50k chars per cell limits. Strict integer KRW and numeric
   percentage input; no `Math.floor`, `Infinity`, 3000-KRW shipping or
   5.5%-fee defaults. Drops PII/unrecognized fields and never echoes raw source
   into error messages. Counts distinct invalid rows correctly.

2. `src/features/batch/types.ts`:
   Nullable invalid/missing financial fields, per-row validationErrors,
   separate user-attested scenario and conditional `ESTIMATE_ONLY` status.

3. `server/batch/batchProcessor.ts`:
   Outputs `ERROR` on invalid financial/market input and
   `REVIEW_REQUIRED` with null costs when evidence is absent.
   Only complete, explicit user-attested refund cost + policy conditions can
   call the existing domain `compareAlternatives` legal/financial gate.
   Refunds vs exchanges remain separate. Customer exchange requests never
   receive a refund recommendation; seller-fault buyer fee is blocked.
   Conditional estimates keep their assumptions and do not claim legal approval
   or realized cash profit.

4. `server/batch/csvSanitizer.ts`:
   Formula-like ASCII/fullwidth/hidden-prefix handling, RFC double-quote
   escaping and CRLF output. More important, `generateBatchExportCsv`
   whitelists source fields and never reflects raw messages/PII into CSV.

5. `tests/batch/s4_csv_security.test.ts`:
   More coverage for quoted multiline records, malformed quote attacks,
   UTF-8, missing/invalid financial fields, distinct row errors, PII,
   policy/consent gates, partial refund, exchange, seller fault, mismatched
   scenario, formula export and cancelled batches.

6. Synthetic usage:
   `docs/samples/S4_MINIMAL.csv`
   `docs/samples/S4_ATTESTED.csv`

7. Full security and schema guide:
   `docs/security/S4_CSV_CONTRACT.md`

## Independent conclusions

- S4 parser and conditional batch decision engine: **PASS in Node/CI**.
- 477/477 includes tests from S1 through S4; S4 added 38 tests over the
  S3 baseline of 439.
- Actual browser-based CSV upload flow, Excel/Sheets save-and-reopen
  interoperability, authenticated batch HTTP upload, Cloudflare D1/R2
  storage, server quota and rate-limiting: **NOT TESTED / NOT IMPLEMENTED**.
- Spreadsheet formula mitigation is not universally safe across programs.
  Export depends primarily on whitelisting all output data.
- User-supplied confirmation flags are **attestations** and are not
  independently verified legal or marketplace compliance.

## Next stage S5

Actual Playwright/axe browser E2E for UI/mobile and CSV error presentation,
authentic upload workflow, server-side rate limits/quota and hostile-input
browser tests. S1-S3 production staging approvals are still pending.

**Release: Pro/Billing remains BLOCKED, main branch unchanged.**
