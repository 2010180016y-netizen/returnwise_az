/**
 * S4 strict RFC 4180-compatible CSV ingest.
 *
 * - Parses quoted commas, embedded CRLF/LF, and escaped double quotes.
 * - No financial defaults, coercion, fractional-won truncation or raw-value logs.
 * - Unknown and PII columns are discarded during row normalization.
 * - Optional policy/financial columns form user-ATTESTED, not legally certified,
 *   input to the existing domain comparison engine.
 */
import type {
  BatchRowInput, BatchValidationSummary, BatchProcessingOptions,
  AttestedBatchScenario,
} from './types';
import type { DecisionFlags, PlatformType, ReturnReason, BuyerRequest, ScenarioInput } from '../../domain/types';

const MAX_ROWS = 1000;
const MAX_COLS = 64;
const MAX_CELL_CHARS = 50000;
const MAX_KRW = 1_000_000_000_000;
const PII_HEADER_REGEX =
  /(고객|수령인|구매자|이름|성명|name|buyer|전화|연락처|핸드폰|휴대폰|phone|주소|배송지|address|주문번호|order_id|order_no|order_number|통관|email|이메일|메모|note)/i;

const ALIASES: Record<string, string[]> = {
  itemPrice: ['판매가', '상품가', '결제금액', 'price', 'item_price'],
  initialShipping: ['초기배송비', '배송비', '발송배송비', 'initial_shipping'],
  returnShipping: ['회수배송비', '반품배송비', 'return_shipping'],
  commissionRate: ['수수료율', '수수료', 'commission_rate'],
  market: ['마켓', '플랫폼', '쇼핑몰', 'market', 'platform'],
  refundAmount: ['환급액', 'refund_amount'],
  handlingCost: ['검수비', 'handling_cost'],
  recoveredItemNetValue: ['회수순가치', 'recovered_item_net_value'],
  feeReversalCredit: ['수수료환급액', 'fee_reversal_credit'],
  additionalSellerCost: ['기타추가비', 'additional_seller_cost'],
  reverseShippingBuyerCost: ['구매자회수비', 'reverse_shipping_buyer_cost'],
  reason: ['귀책사유', 'return_reason'],
  buyerRequest: ['고객요청', 'buyer_request'],
  policyReviewed: ['정책확인', 'policy_reviewed'],
  rightsReviewed: ['권리확인', 'rights_reviewed'],
  isSpecialItem: ['특례품목', 'special_item'],
  isPolicyOutdated: ['정책구버전', 'policy_outdated'],
  agreedPartialRefund: ['합의부분환급액', 'agreed_partial_refund'],
  voluntaryAgreementConfirmed: ['자발적합의확인', 'voluntary_agreement_confirmed'],
  permittedByPolicyConfirmed: ['부분환급약관허용', 'partial_allowed_by_policy'],
  rightsNotRestrictedConfirmed: ['소비자권리비침해확인', 'rights_not_restricted'],
  buyerAgreedExchange: ['교환동의', 'buyer_agreed_exchange'],
  replacementCost: ['교환원가', 'replacement_cost'],
  replacementOutboundShipping: ['교환출고비', 'replacement_outbound_shipping'],
};

const REQUIRED_FINANCIAL = [
  'refundAmount', 'handlingCost', 'recoveredItemNetValue',
  'feeReversalCredit', 'additionalSellerCost', 'reverseShippingBuyerCost',
] as const;
const REQUIRED_CONTEXT = [
  'reason', 'buyerRequest', 'policyReviewed', 'rightsReviewed',
  'isSpecialItem', 'isPolicyOutdated',
] as const;

type RecordCallback = (cells: string[], rowIndex: number, lineNumber: number) => void;

/** Each callback receives only one physical CSV record at a time. */
function scanCsv(content: string, onRecord: RecordCallback): void {
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  let state: 'START' | 'UNQUOTED' | 'QUOTED' | 'AFTER_QUOTE' = 'START';
  let field = '';
  let fields: string[] = [];
  let recordIndex = 0;
  let line = 1;
  let recordStartLine = 1;

  const pushCell = () => {
    if (field.length > MAX_CELL_CHARS) throw new Error('CSV 셀 크기 한도를 초과했습니다.');
    fields.push(field);
    if (fields.length > MAX_COLS) throw new Error('CSV 열 수 한도를 초과했습니다.');
    field = '';
    state = 'START';
  };
  const pushRecord = () => {
    pushCell();
    if (!(fields.length === 1 && fields[0].trim() === '')) {
      onRecord(fields, recordIndex, recordStartLine);
      recordIndex++;
    }
    fields = [];
    recordStartLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\0') throw new Error('CSV에 허용되지 않는 제어문자가 있습니다.');

    const lineBreak = ch === '\r' || ch === '\n';
    const crlf = ch === '\r' && text[i + 1] === '\n';
    if (lineBreak) {
      if (state === 'QUOTED') {
        field += crlf ? '\r\n' : ch;
      } else {
        pushRecord();
      }
      if (crlf) i++;
      line++;
      if (state !== 'QUOTED') recordStartLine = line;
      continue;
    }

    if (state === 'QUOTED') {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; i++;
        } else {
          state = 'AFTER_QUOTE';
        }
      } else {
        field += ch;
      }
      if (field.length > MAX_CELL_CHARS) throw new Error('CSV 셀 크기 한도를 초과했습니다.');
      continue;
    }

    if (state === 'AFTER_QUOTE') {
      if (ch === ',') {
        pushCell();
      } else {
        throw new Error('CSV 따옴표 뒤에 허용되지 않는 문자가 있습니다.');
      }
      continue;
    }

    if (ch === ',') {
      pushCell();
    } else if (ch === '"') {
      if (state !== 'START') throw new Error('CSV 필드의 따옴표 형식이 올바르지 않습니다.');
      state = 'QUOTED';
    } else {
      field += ch;
      state = 'UNQUOTED';
    }
    if (field.length > MAX_CELL_CHARS) throw new Error('CSV 셀 크기 한도를 초과했습니다.');
  }

  if (state === 'QUOTED') throw new Error('CSV 따옴표가 닫히지 않았습니다.');
  if (fields.length > 0 || field.length > 0 || state !== 'START') pushRecord();
}

function limits(options: BatchProcessingOptions) {
  const maxRows = options.maxRows ?? MAX_ROWS;
  const maxFileMb = options.maxFileSizeMb ?? 5;
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS ||
      !Number.isFinite(maxFileMb) || maxFileMb <= 0 || maxFileMb > 5) {
    throw new Error('CSV 처리 한도 설정이 올바르지 않습니다.');
  }
  return { maxRows, maxBytes: Math.floor(maxFileMb * 1024 * 1024) };
}

function parseUnsignedWon(raw: string): number | null {
  const v = raw.trim();
  if (!/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(v)) return null;
  const num = Number(v.replace(/,/g, ''));
  return Number.isSafeInteger(num) && num <= MAX_KRW ? num : null;
}

function parsePercent(raw: string): number | null {
  const v = raw.trim();
  if (!/^\d{1,3}(?:\.\d{1,4})?%?$/.test(v)) return null;
  const n = Number(v.replace('%', ''));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function parseBoolean(raw: string): boolean | undefined {
  const v = raw.trim().normalize('NFKC').toUpperCase();
  if (['TRUE', 'Y', 'YES', '1', '예', '확인'].includes(v)) return true;
  if (['FALSE', 'N', 'NO', '0', '아니오', '미확인'].includes(v)) return false;
  return undefined;
}

function parseMarket(raw: string): {market: string; platform: PlatformType} | null {
  const v = raw.trim().normalize('NFKC').toUpperCase();
  if (['NAVER','SMARTSTORE','네이버','스마트스토어'].includes(v)) return {market:'SMARTSTORE',platform:'NAVER'};
  if (['COUPANG','쿠팡'].includes(v)) return {market:'COUPANG',platform:'COUPANG'};
  if (['INDEPENDENT','OWN','자사몰'].includes(v)) return {market:'INDEPENDENT',platform:'INDEPENDENT'};
  return null;
}

function parseReason(raw: string): ReturnReason | undefined {
  const v = raw.trim().toUpperCase();
  if (v === 'BUYER_REMORSE' || v === 'SELLER_FAULT' || v === 'DEFECT_OR_DIFF') return v;
  return undefined;
}
function parseRequest(raw: string): BuyerRequest | undefined {
  const v = raw.trim().toUpperCase();
  if (v === 'REFUND' || v === 'EXCHANGE') return v;
  return undefined;
}

export function parseCsvText(
  csvContent: string,
  options: BatchProcessingOptions = {}
): { rows: BatchRowInput[]; summary: BatchValidationSummary } {
  if (typeof csvContent !== 'string') throw new Error('CSV 문자열이 필요합니다.');
  const config = limits(options);
  const byteLength = new TextEncoder().encode(csvContent).byteLength;
  if (byteLength > config.maxBytes) {
    throw new Error(
      '파일 크기가 허용 한도(' + (options.maxFileSizeMb ?? 5) +
      'MB)를 초과했습니다. (현재: ' + (byteLength / 1048576).toFixed(2) + 'MB)'
    );
  }
  const rows: BatchRowInput[] = [];
  const errors: BatchValidationSummary['columnErrors'] = [];
  const detectedPiiColumns: string[] = [];
  const headerIndexes = new Map<string,number>();
  let headerWidth = 0;
  let headerFound = false;

  const addError = (rowNumber: number, column: string, code: string) => {
    errors.push({ rowNumber, column, message: code });
  };

  scanCsv(csvContent, (cells, recordIndex, sourceLine) => {
    if (options.signal?.aborted) throw new Error('BATCH_PROCESSING_CANCELLED');
    if (!headerFound) {
      headerFound = true;
      headerWidth = cells.length;
      const normalized = new Set<string>();
      cells.forEach((h,idx) => {
        const v = h.trim().normalize('NFKC').toLowerCase();
        if (!v || normalized.has(v)) throw new Error('CSV 헤더가 비어 있거나 중복되었습니다.');
        normalized.add(v);
        if (PII_HEADER_REGEX.test(v)) {
          // Keep only ordinary header labels for legacy UI warning; no cell values.
          detectedPiiColumns.push(v.length > 60 ? '[민감정보 열]' : v);
        }
        for (const [name,aliases] of Object.entries(ALIASES)) {
          if (aliases.some(a => a.toLowerCase() === v)) {
            if (headerIndexes.has(name)) throw new Error('CSV 필수 열의 별칭이 중복되었습니다.');
            headerIndexes.set(name,idx);
          }
        }
      });
      if (!headerIndexes.has('itemPrice')) {
        throw new Error('필수 열 [판매가] 또는 [상품가]가 CSV에 존재하지 않습니다.');
      }
      return;
    }
    if (recordIndex > config.maxRows) {
      throw new Error('CSV 행 수가 허용 한도(' + config.maxRows +
        '행)를 초과했습니다. (현재: ' + recordIndex + '행 이상)');
    }
    const rowNumber = recordIndex + 1;
    const validationErrors: string[] = [];
    const fail = (column: string, code: string) => {
      validationErrors.push(column + ': ' + code);
      addError(rowNumber,column,code);
    };

    if (cells.length !== headerWidth) fail('CSV', '열 개수가 헤더와 일치하지 않습니다.');

    const cell = (key: string): string | undefined => {
      const idx = headerIndexes.get(key);
      return idx === undefined || idx >= cells.length ? undefined : cells[idx];
    };
    const money = (key: string, label: string, required: boolean): number | null | undefined => {
      const raw = cell(key);
      if (raw === undefined || raw.trim() === '') {
        if (required) fail(label,'금액이 누락되었습니다.');
        return required ? null : undefined;
      }
      const value = parseUnsignedWon(raw);
      if (value === null) fail(label,'0원 이상의 정수 금액 형식이 아닙니다.');
      return value;
    };
    const boolean = (key: string): boolean | undefined => {
      const raw = cell(key);
      if (raw === undefined || raw.trim() === '') return undefined;
      const value = parseBoolean(raw);
      if (value === undefined) fail(key,'확인 여부를 YES/NO로 입력해야 합니다.');
      return value;
    };

    const itemPrice = money('itemPrice','판매가',true) ?? null;
    if (itemPrice === 0) fail('판매가','판매가는 0원보다 커야 합니다.');
    const initialShipping = money('initialShipping','초기배송비',true) ?? null;
    const returnShipping = money('returnShipping','회수배송비',true) ?? null;
    const rateText = cell('commissionRate')?.trim();
    let commissionRate: number | null = null;
    if (!rateText) fail('수수료율','수수료율이 누락되었습니다.');
    else {
      commissionRate = parsePercent(rateText);
      if (commissionRate === null) fail('수수료율','0~100%의 숫자 형식이 아닙니다.');
    }
    const parsedMarket = cell('market') ? parseMarket(cell('market') ?? '') : null;
    if (!parsedMarket) fail('마켓','지원하는 마켓 코드가 아닙니다.');

    const clean: Record<string,string|number> = {};
    const market = parsedMarket?.market ?? 'UNKNOWN';
    clean.market = market;
    for (const [k,v] of Object.entries({itemPrice,initialShipping,returnShipping,commissionRate})) {
      if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v;
    }
    const row: BatchRowInput = {
      rowNumber, sourceLine, itemPrice, initialShipping, returnShipping,
      commissionRate, market, rawPiiCleaned: clean, validationErrors,
    };

    const evidencePresent = [...REQUIRED_FINANCIAL,...REQUIRED_CONTEXT]
      .every(k => headerIndexes.has(k));
    if (evidencePresent && parsedMarket) {
      const amounts = {} as Record<string,number>;
      let complete = true;
      for (const key of REQUIRED_FINANCIAL) {
        const val = money(key,key,false);
        if (val === undefined || val === null) complete = false;
        else amounts[key] = val;
      }
      const bools = {} as Record<string,boolean>;
      for (const key of ['policyReviewed','rightsReviewed','isSpecialItem','isPolicyOutdated'] as const) {
        const v = boolean(key);
        if (v === undefined) complete = false;
        else bools[key] = v;
      }
      const reason = parseReason(cell('reason') ?? '');
      const buyerRequest = parseRequest(cell('buyerRequest') ?? '');
      if (!reason || !buyerRequest) complete = false;

      const partial = money('agreedPartialRefund','합의부분환급액',false);
      const replacement = money('replacementCost','교환원가',false);
      const outbound = money('replacementOutboundShipping','교환출고비',false);
      const agreement=boolean('voluntaryAgreementConfirmed');
      const allowed=boolean('permittedByPolicyConfirmed');
      const rights=boolean('rightsNotRestrictedConfirmed');
      const exchangeAgreed=boolean('buyerAgreedExchange');
      if (complete && reason && buyerRequest && returnShipping !== null && itemPrice !== null) {
        const flags:DecisionFlags = {
          reason,buyerRequest,platform:parsedMarket.platform,
          policyReviewed:bools.policyReviewed, rightsReviewed:bools.rightsReviewed,
          isSpecialItem:bools.isSpecialItem, isPolicyOutdated:bools.isPolicyOutdated,
          voluntaryAgreementConfirmed:agreement===true,
          permittedByPolicyConfirmed:allowed===true,
          rightsNotRestrictedConfirmed:rights===true,
          buyerAgreedExchange:exchangeAgreed===true,
        };
        const inputs:ScenarioInput = {
          refundAmount:amounts.refundAmount,
          reverseShippingSellerCost:returnShipping,
          reverseShippingBuyerCost:amounts.reverseShippingBuyerCost,
          handlingCost:amounts.handlingCost,
          recoveredItemNetValue:amounts.recoveredItemNetValue,
          feeReversalCredit:amounts.feeReversalCredit,
          additionalSellerCost:amounts.additionalSellerCost,
        };
        if (partial !== undefined && partial !== null) inputs.agreedPartialRefund = partial;
        if (replacement !== undefined && replacement !== null) inputs.replacementCost = replacement;
        if (outbound !== undefined && outbound !== null) inputs.replacementOutboundShipping = outbound;
        const attested:AttestedBatchScenario = { flags, inputs };
        row.attestedScenario = attested;
      }
    }

    rows.push(row);
  });

  if (!headerFound) throw new Error('CSV 파일에 내용이 없습니다.');
  const errorRows = rows.filter(r => (r.validationErrors?.length ?? 0) > 0).length;
  return {
    rows,
    summary: {
      totalRows:rows.length, validRows:rows.length-errorRows,errorRows,
      detectedPiiColumns,piiWarning:detectedPiiColumns.length>0,columnErrors:errors,
    },
  };
}

/** Reject legacy or corrupt text encodings instead of replacing invalid bytes with U+FFFD. */
export function parseCsvBytes(
  bytes:Uint8Array,
  options:BatchProcessingOptions = {}
): ReturnType<typeof parseCsvText> {
  const cfg = limits(options);
  if(bytes.byteLength > cfg.maxBytes) throw new Error('CSV 파일 크기가 허용 한도를 초과했습니다.');
  let text:string;
  try {
    text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes);
  } catch {
    throw new Error('UTF-8 인코딩이 아닌 파일입니다. CSV를 UTF-8로 다시 저장해 주세요.');
  }
  return parseCsvText(text,options);
}