# ReturnWise S4 — CSV parsing, batch decisions and spreadsheet output security

Date: 2026-11-03 (Asia/Seoul)
Scope: `src/features/batch`, `server/batch`, `tests/batch`.
Branch: `audit/s4-csv-hardening`; PR: https://github.com/2010180016y-netizen/returnwise_az/pull/4

## Import contracts

- Accept UTF-8 (optionally with BOM); `parseCsvBytes` uses a fatal decoder to reject
  lossy/non-UTF8 byte sequences. Source text is processed in memory only.
- CSV follows RFC 4180 record semantics for quoted commas, doubled quotes,
  embedded CRLF/LF and multiline fields. Invalid or unclosed quotation
  marks are rejected instead of silently shifting the column mapping.
- Limits are hard-capped at **5 MiB, 1,000 logical data records, 64 columns and
  50,000 characters per cell**. User options cannot bypass the hard cap.
- Duplicate business header aliases, mismatched cell counts and malformed
  financial values result in explicit errors.
- Required minimum headers:
  `판매가`, `초기배송비`, `회수배송비`, `수수료율`, `마켓`.
  Valid markets: SMARTSTORE/NAVER, COUPANG, INDEPENDENT/OWN.
- KRW amounts must be non-negative integers (up to 10^12) and commission
  rates finite decimals from 0 to 100. No implicit cost, shipping, commission
  or residual-product-value default is ever applied.
- Unknown/PII columns are not included in the returned normalized rows;
  error messages never contain the uploaded cell value or free-form header.
  `errorRows` counts distinct invalid records, not invalid cells.

Synthetic import samples:
- `docs/samples/S4_MINIMAL.csv`
- `docs/samples/S4_ATTESTED.csv`

## Decision contract

The minimum CSV produces `REVIEW_REQUIRED` results with null
cash/economic costs and null savings; it does not manufacture customer
agreement or policy compliance.

For a **user-attested conditional refund estimate**, every required base
column must be valid AND these further fields must be explicitly present:

1. Monetary: `환급액`, `검수비`, `회수순가치`,
   `수수료환급액`, `기타추가비`, `구매자회수비`
2. Context: `귀책사유`, `고객요청`
3. Explicit yes/no review: `정책확인`, `권리확인`,
   `특례품목`, `정책구버전`

Allowed reason codes: `BUYER_REMORSE`, `SELLER_FAULT`,
`DEFECT_OR_DIFF`; buyer request: `REFUND`, `EXCHANGE`.
Optional partial refund fields: `합의부분환급액`,
`자발적합의확인`, `부분환급약관허용`,
`소비자권리비침해확인`. Optional exchange fields exist
but the S4 refund-only batch does NOT recommend exchanges.

Only when the **customer requested REFUND**, the user explicitly
asserts policy/rights checks, costs are internally consistent, and
the domain legal gate returns at least two eligible refund alternatives
including RETURN_FULL baseline, compute economic cost via the existing
`compareAlternatives` domain engine. Report `ESTIMATE_ONLY`,
not legal certification or actual cash profit.

A spreadsheet boolean is only the uploader's statement; it is NOT
independent verification of legal compliance or customer consent.
S4 does not contact marketplaces, change orders or execute a refund.

## Export contracts

- The result exporter whitelists market, status, option name/code and
  numeric fields; raw uploaded cells and free-text failure messages are
  never reflected into the CSV.
- Additional escaping applies formula-prefix filtering and RFC 4180
  quote/double-quote rules, emitted CRLF between records.
- OWASP warns CSV-escaping formulas cannot be guaranteed safe in every
  spreadsheet, particularly after save-and-reopen. Do NOT present
  `sanitizeCell` as universally safe for arbitrary untrusted CSV export.

References:
- RFC 4180: https://www.rfc-editor.org/rfc/rfc4180.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection

## Remaining gates

- S4 covers the parser, normalization and batch calculation logic only;
  there is no public authenticated CSV upload endpoint and no external
  data storage/processing deployment.
- Real browser upload UX, accessibility, error presentation, and
  secure S3 quota/D1/R2 ingestion are not integrated.
- Cloudflare staging, remote D1, PG and user legal review remain blocked
  from earlier steps.
- End-to-end spreadsheet import/edit/export tests in actual Excel,
  LibreOffice and Google Sheets still need a compatibility test matrix.
- No real customer PII or real orders were imported during this work.

Verdict is based on actual CI for the S4 PR, never documentation
alone. Pro production/public billing remains BLOCKED.
