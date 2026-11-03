/**
 * ReturnWise Pro CSV Parser with PII Detection & Size Limits (src/features/batch/csvParser.ts)
 *
 * SPECIAL SAFETY CONDITION:
 * 반품 주문 원본 CSV의 개인정보(이름, 주소, 전화번호, 주문번호)를 감지하고,
 * 경고를 발령함과 동시에 메모리 단계에서 즉시 폐기(Drop)하여 절대 저장하지 않음.
 */

import type {
  BatchRowInput,
  BatchValidationSummary,
  BatchProcessingOptions,
} from './types';

const PII_HEADER_REGEX =
  /(고객|수령인|구매자|이름|성명|name|buyer|전화|연락처|핸드폰|휴대폰|phone|주소|배송지|address|주문번호|order_id|order_no|order_number|통관)/i;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_ALLOWED_ROWS = 1000;

export function parseCsvText(
  csvContent: string,
  options: BatchProcessingOptions = {}
): {
  rows: BatchRowInput[];
  summary: BatchValidationSummary;
} {
  const maxRows = options.maxRows || MAX_ALLOWED_ROWS;
  const maxBytes = options.maxFileSizeMb ? options.maxFileSizeMb * 1024 * 1024 : MAX_FILE_SIZE_BYTES;

  // 1. File size limit check
  const byteLength = Buffer.byteLength(csvContent, 'utf-8');
  if (byteLength > maxBytes) {
    throw new Error(
      `파일 크기가 허용 한도(${options.maxFileSizeMb || 5}MB)를 초과했습니다. (현재: ${(byteLength / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  // 2. Strip UTF-8 BOM if present
  let cleanContent = csvContent;
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  const rawLines = cleanContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    throw new Error('CSV 파일에 내용이 없습니다.');
  }

  // 3. Header analysis & PII detection
  const headerLine = rawLines[0];
  const rawHeaders = splitCsvRow(headerLine);

  const detectedPiiColumns: string[] = [];
  const headerMap = new Map<string, number>();

  rawHeaders.forEach((h, idx) => {
    const trimmed = h.trim();
    if (PII_HEADER_REGEX.test(trimmed)) {
      detectedPiiColumns.push(trimmed);
    }
    headerMap.set(trimmed.toLowerCase(), idx);
  });

  const piiWarning = detectedPiiColumns.length > 0;

  // 4. Row limit check
  const dataLines = rawLines.slice(1);
  if (dataLines.length > maxRows) {
    throw new Error(
      `CSV 행 수가 허용 한도(${maxRows}행)를 초과했습니다. (현재: ${dataLines.length}행)`
    );
  }

  const rows: BatchRowInput[] = [];
  const columnErrors: { rowNumber: number; column: string; message: string }[] = [];

  // Helper to find column index from synonyms
  const findCol = (...synonyms: string[]): number => {
    for (const syn of synonyms) {
      const idx = headerMap.get(syn.toLowerCase());
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const colItemPrice = findCol('판매가', '상품가', '결제금액', 'price', 'item_price');
  const colInitShipping = findCol('초기배송비', '배송비', '발송배송비', 'initial_shipping');
  const colRetShipping = findCol('회수배송비', '반품배송비', 'return_shipping');
  const colCommRate = findCol('수수료율', '수수료', 'commission_rate');
  const colMarket = findCol('마켓', '플랫폼', '쇼핑몰', 'market', 'platform');

  if (colItemPrice === -1) {
    throw new Error('필수 열 [판매가] 또는 [상품가]가 CSV에 존재하지 않습니다.');
  }

  dataLines.forEach((line, index) => {
    const rowNumber = index + 2; // 1-indexed including header
    const cells = splitCsvRow(line);

    const parseNum = (colIdx: number, defaultVal: number = 0, colName: string): number => {
      if (colIdx === -1 || colIdx >= cells.length) return defaultVal;
      const valStr = cells[colIdx].replace(/,/g, '').trim();
      const num = Number(valStr);
      if (isNaN(num) || num < 0) {
        columnErrors.push({
          rowNumber,
          column: colName,
          message: `유효하지 않은 숫자 값입니다: "${cells[colIdx]}"`,
        });
        return defaultVal;
      }
      return Math.floor(num);
    };

    const itemPrice = parseNum(colItemPrice, 0, '판매가');
    const initialShipping = parseNum(colInitShipping, 3000, '초기배송비');
    const returnShipping = parseNum(colRetShipping, 3000, '회수배송비');

    let commissionRate = 0;
    if (colCommRate !== -1 && colCommRate < cells.length) {
      const rateStr = cells[colCommRate].replace(/%/g, '').trim();
      const rate = Number(rateStr);
      commissionRate = !isNaN(rate) && rate >= 0 ? rate : 5.5;
    } else {
      commissionRate = 5.5; // 기본 스마트스토어 기준
    }

    const market = colMarket !== -1 && colMarket < cells.length ? cells[colMarket].trim() : 'SMARTSTORE';

    // SPECIAL SAFETY CONDITION: Cleanse all PII from raw record
    const rawPiiCleaned: Record<string, string | number> = {
      itemPrice,
      initialShipping,
      returnShipping,
      commissionRate,
      market,
    };

    rows.push({
      rowNumber,
      market,
      itemPrice,
      initialShipping,
      returnShipping,
      commissionRate,
      rawPiiCleaned, // strictly No-PII
    });
  });

  const summary: BatchValidationSummary = {
    totalRows: dataLines.length,
    validRows: rows.length - columnErrors.length,
    errorRows: columnErrors.length,
    detectedPiiColumns,
    piiWarning,
    columnErrors,
  };

  return { rows, summary };
}

/**
 * Splits CSV row handling double quotes
 */
function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
