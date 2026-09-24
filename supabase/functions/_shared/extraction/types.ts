/**
 * The one interface every statement-reading provider implements (mock
 * today, Anthropic when the key is added). The extract-document Edge
 * Function only talks to this interface, so switching providers is a matter
 * of secrets (AI_PROVIDER, AI_MODEL, ANTHROPIC_API_KEY), not code.
 *
 * Privacy: file bytes, file names, amounts and transaction descriptions
 * never go into an error message, a thrown error or a log line.
 */

export type TransactionCategory = 'income' | 'own_transfer' | 'refund' | 'loan' | 'reversal' | 'unsure';

export const TRANSACTION_CATEGORIES: TransactionCategory[] = [
  'income',
  'own_transfer',
  'refund',
  'loan',
  'reversal',
  'unsure',
];

/** What a provider must hand back (the structured-output schema in
 * schema.ts). Amounts are in the statement's currency, major units
 * (e.g. 1234.56). The Edge Function validates this strictly before use. */
export interface RawExtraction {
  readable: boolean;
  is_statement: boolean;
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  total_inflows: number | null;
  transactions: RawTransaction[];
}

export interface RawTransaction {
  date: string;
  amount: number;
  description: string;
  category: TransactionCategory;
}

/** Only these types reach a provider; everything else is refused earlier. */
export type SupportedMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface ProviderInput {
  file: Uint8Array;
  mimeType: SupportedMimeType;
  /** The tax year the document was uploaded for (context only). */
  taxYear: number;
  /** The document's file name. Only the mock provider uses it, to pick a
   * test case; real providers must not send or log it. */
  fileName: string;
}

export interface ProviderResult {
  /** The provider's structured output, not yet trusted. */
  output: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractionProvider {
  /** Stored as document_extractions.provider. */
  name: string;
  /** The model that will be used (stored as document_extractions.model). */
  model(): string;
  extract(input: ProviderInput): Promise<ProviderResult>;
}

/** Final statuses a failed read can end in (see the migration's comments). */
export type FailureStatus = 'failed' | 'unreadable';

export type ExtractionErrorCode =
  // unreadable: the file itself can't be read; retrying won't help
  | 'unreadable'
  | 'not_a_statement'
  | 'password_protected'
  | 'too_many_pages'
  | 'unsupported_type'
  | 'file_too_large'
  | 'corrupt_file'
  // failed: our side or the provider's; the user can try again
  | 'timeout'
  | 'provider_unavailable'
  | 'invalid_output'
  | 'refused'
  | 'too_long'
  | 'download_failed'
  | 'config_error'
  | 'internal';

const UNREADABLE_CODES: ExtractionErrorCode[] = [
  'unreadable',
  'not_a_statement',
  'password_protected',
  'too_many_pages',
  'unsupported_type',
  'file_too_large',
  'corrupt_file',
];

/** Thrown by providers and checks. `detail` is for server logs and must
 * never contain document content, amounts or names. */
export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  readonly status: FailureStatus;
  /** Tokens already paid for when the failure happened (e.g. bad output). */
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;

  constructor(
    code: ExtractionErrorCode,
    detail?: string,
    usage?: { inputTokens: number; outputTokens: number }
  ) {
    super(detail ?? code);
    this.name = 'ExtractionError';
    this.code = code;
    this.status = UNREADABLE_CODES.includes(code) ? 'unreadable' : 'failed';
    this.inputTokens = usage?.inputTokens ?? null;
    this.outputTokens = usage?.outputTokens ?? null;
  }
}
