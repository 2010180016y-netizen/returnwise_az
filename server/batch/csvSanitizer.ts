/**
 * ReturnWise Pro CSV Formula Injection Sanitizer (server/batch/csvSanitizer.ts)
 *
 * SPECIAL SAFETY CONDITION:
 * CSV Injection / Formula Injection 방어:
 * 스프레드시트(Excel, Google Sheets)에서 DDE 수식 실행을 유발할 수 있는
 * 특수문자(=, +, -, @, \t, \r)로 시작하는 셀 값을 감지하여 작은따옴표(') 접두어로 무력화.
 */

const DANGEROUS_FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a single CSV cell value against formula injection
 */
export function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If starts with formula triggers, prepend a single quote (')
  if (DANGEROUS_FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    return `'${str}`;
  }

  // If contains commas, double quotes, or newlines, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Sanitizes an entire CSV row array
 */
export function sanitizeRow(row: unknown[]): string {
  return row.map(sanitizeCell).join(',');
}

/**
 * Serializes data into a completely sanitized CSV text
 */
export function serializeSafeCsv(headers: string[], rows: unknown[][]): string {
  const safeHeaders = sanitizeRow(headers);
  const safeRows = rows.map(sanitizeRow);
  return [safeHeaders, ...safeRows].join('\n');
}
