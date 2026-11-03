/**
 * S4 strict batch boundary.
 * Raw CSV fields (including unknown / PII columns) never escape the parser.
 */
import type { DecisionFlags, ScenarioInput } from '../../domain/types';

export interface AttestedBatchScenario {
  /** User-supplied confirmations; never proof of legal compliance. */
  flags: DecisionFlags;
  /** Every input used in the refund comparison is explicitly supplied. */
  inputs: ScenarioInput;
}

export interface BatchRowInput {
  rowNumber: number;
  sourceLine?: number;
  market: string;
  itemPrice: number | null;
  initialShipping: number | null;
  returnShipping: number | null;
  commissionRate: number | null;
  rawPiiCleaned: Record<string, string | number>;
  /** Generic, sanitized messages only: never reflect raw spreadsheet values. */
  validationErrors?: string[];
  /** Present only if all required policy and financial evidence fields are explicit. */
  attestedScenario?: AttestedBatchScenario;
}

export interface BatchRowResult {
  rowNumber: number;
  market: string;
  itemPrice: number | null;
  bestOptionCode: string;
  bestOptionName: string;
  cashOutflow: number | null;
  economicCost: number | null;
  savingsVsBaseline: number | null;
  /** ESTIMATE_ONLY is an informational comparison, NOT legal certification. */
  status: 'ESTIMATE_ONLY' | 'SUCCESS' | 'REVIEW_REQUIRED' | 'ERROR';
  errorMessage?: string;
}

export interface BatchValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  detectedPiiColumns: string[];
  piiWarning: boolean;
  columnErrors: {
    rowNumber: number;
    column: string;
    message: string;
  }[];
}

export interface BatchProcessingOptions {
  maxRows?: number; // up to 1000
  maxFileSizeMb?: number; // up to 5 MiB
  concurrencyLimit?: number;
  signal?: AbortSignal;
}