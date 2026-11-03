/**
 * Spreadsheet CSV cell serializer with formula-injection defense.
 * The apostrophe MUST be applied before CSV quoting. Quoting alone does not
 * stop Excel / spreadsheet applications from evaluating an imported formula.
 */
function looksLikeFormula(raw: string): boolean {
  let i = 0;
  while (i < raw.length) {
    const unit = raw.charCodeAt(i);
    if (unit <= 32 || unit === 0xfeff) i++;
    else break;
  }
  const first = raw.charAt(i);
  const unsafe = first === '=' || first === '+' || first === '-' || first === '@';
  const firstUnit = raw.charCodeAt(0);
  return unsafe || firstUnit === 9 || firstUnit === 10 || firstUnit === 13;
}

export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  const raw = String(value);
  const formulaLike = looksLikeFormula(raw);
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
