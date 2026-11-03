/**
 * S4 spreadsheet CSV output.
 * RFC 4180 quote escaping + defense-in-depth for formula-like values.
 *
 * OWASP warns there is NO portable guarantee across Excel/Sheets and
 * save/reopen cycles. Primary protection: never export untrusted free text
 * or personal details from the batch processor; this is secondary hardening.
 *
 * https://owasp.org/www-community/attacks/CSV_Injection
 */
function looksLikeFormula(raw: string): boolean {
  const normalized=raw.normalize('NFKC');
  let i=0;
  while(i<normalized.length) {
    const code=normalized.charCodeAt(i);
    const whitespace=code<=32 || code===0xfeff || code===0x00a0 ||
      code===0x200b || code===0x2028 || code===0x2029;
    if(!whitespace) break;
    i++;
  }
  const first=normalized.charAt(i);
  return first==='=' || first==='+' || first==='-' || first==='@' ||
    normalized.charCodeAt(0)===9 || normalized.charCodeAt(0)===10 ||
    normalized.charCodeAt(0)===13;
}

export function sanitizeCell(value: unknown): string {
  if (value===null || value===undefined) return '';
  const raw=String(value);
  // No escaping-only strategy can guarantee safety in all spreadsheet apps.
  const safe=looksLikeFormula(raw)?"'"+raw:raw;
  if (/[",\r\n]/.test(safe)) return '"'+safe.replace(/"/g,'""')+'"';
  return safe;
}

export function sanitizeRow(row: unknown[]): string {
  return row.map(sanitizeCell).join(',');
}

export function serializeSafeCsv(headers: string[], rows: unknown[][]): string {
  const all=[sanitizeRow(headers),...rows.map(sanitizeRow)];
  return all.join('\r\n');
}