/**
 * Spreadsheet CSV cell serializer with formula-injection defense.
 * The apostrophe MUST be applied before CSV quoting. Quoting alone does not
 * stop Excel / spreadsheet applications from evaluating an imported formula.
 */
const FORMULA_AFTER_LEADING_SPACE = /^[\u0000-\u0020\uFEFF]*[=+@-]/;
const LEADING_CONTROL = /^[\t\r\n]/;

export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = String(value);
  const formulaLike = FORMULA_AFTER_LEADING_SPACE.test(raw) || LEADING_CONTROL.test(raw);
  const safe = formulaLike ? `'${raw}` : raw;

  // Never bypass RFC-style CSV escaping after prefixing formula-like data:
  // dangerous values may also contain commas, quotes, or line breaks.
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function sanitizeRow(row: unknown[]): string {
  return row.map(sanitizeCell).join(',');
}

export function serializeSafeCsv(headers: string[], rows: unknown[][]): string {
  return [sanitizeRow(headers), ...rows.map(sanitizeRow)].join('\n');
}
