/**
 * AI reading of uploaded statements (see
 * supabase/functions/extract-document and
 * supabase/migrations/20260927090000_statement_extraction.sql).
 *
 *  - The server reads the file and writes the result; the app only starts a
 *    read, watches the result row, and answers flagged transactions.
 *  - The suggested income is always worked out by the server. The user
 *    reviews it on Income Summary and confirms it (or types their own).
 *  - If reading fails for any reason, the user just types their income.
 *
 * Nothing here logs amounts, descriptions or file details.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { formatNaira } from './money';
import { supabase } from './supabase';

export type ExtractionStatus = 'pending' | 'processing' | 'done' | 'failed' | 'unreadable';

export type ExtractionWarning =
  | 'partial_year'
  | 'wrong_year'
  | 'period_unknown'
  | 'foreign_currency'
  | 'currency_unknown'
  | 'totals_mismatch'
  | 'no_income_found';

export type TransactionDecision =
  | 'income'
  | 'own_transfer'
  | 'refund'
  | 'loan'
  | 'reversal'
  | 'not_income';

export type FlaggedTransaction = {
  id: string;
  date: string;
  /** Whole minor units of the statement's currency (kobo for NGN). */
  amountMinor: number;
  description: string;
  decision: TransactionDecision | null;
};

export type Extraction = {
  id: string;
  documentId: string;
  status: ExtractionStatus;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string | null;
  /** Server-calculated; null unless a naira statement was read. */
  suggestedIncomeKobo: number | null;
  warnings: ExtractionWarning[];
  errorCode: string | null;
  startedAt: string | null;
  /** Items the user must answer (income or not), oldest first. */
  flagged: FlaggedTransaction[];
};

/** A read still "processing" after this long was abandoned by the server
 * (it can be started again). Matches the Edge Function. */
const STALE_PROCESSING_MS = 5 * 60 * 1000;

/** Waiting for the server: show "Reading your statement…". */
export function isReading(extraction: Extraction | undefined): boolean {
  if (!extraction || (extraction.status !== 'processing' && extraction.status !== 'pending')) {
    return false;
  }
  return (
    extraction.startedAt === null ||
    Date.now() - new Date(extraction.startedAt).getTime() < STALE_PROCESSING_MS
  );
}

/** Couldn't be read, but trying again may work. */
export function canRetry(extraction: Extraction | undefined): boolean {
  if (!extraction) {
    return false;
  }
  return extraction.status === 'failed' || (!isReading(extraction) && extraction.status === 'processing');
}

export function undecidedCount(extraction: Extraction | undefined): number {
  return extraction?.status === 'done' ? extraction.flagged.filter((t) => t.decision === null).length : 0;
}

type Row = {
  id: string;
  document_id: string;
  status: ExtractionStatus;
  period_start: string | null;
  period_end: string | null;
  currency: string | null;
  suggested_income_kobo: number | null;
  warnings: ExtractionWarning[] | null;
  error_code: string | null;
  started_at: string | null;
  extracted_transactions: {
    id: string;
    date: string;
    amount_kobo: number;
    description: string;
    user_decision: TransactionDecision | null;
    position: number;
  }[];
};

function toExtraction(row: Row): Extraction {
  return {
    id: row.id,
    documentId: row.document_id,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    currency: row.currency,
    suggestedIncomeKobo: row.suggested_income_kobo,
    warnings: row.warnings ?? [],
    errorCode: row.error_code,
    startedAt: row.started_at,
    flagged: [...(row.extracted_transactions ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        id: t.id,
        date: t.date,
        amountMinor: t.amount_kobo,
        description: t.description,
        decision: t.user_decision,
      })),
  };
}

/** The read results for these documents, keyed by document id. Documents
 * never sent for reading simply have no entry. */
export async function getExtractions(
  documentIds: string[]
): Promise<{ extractions: Record<string, Extraction>; error: boolean }> {
  if (documentIds.length === 0) {
    return { extractions: {}, error: false };
  }
  const { data, error } = await supabase
    .from('document_extractions')
    .select(
      'id, document_id, status, period_start, period_end, currency, suggested_income_kobo, warnings, error_code, started_at, extracted_transactions(id, date, amount_kobo, description, user_decision, position)'
    )
    .in('document_id', documentIds)
    .eq('extracted_transactions.needs_review', true);
  if (error) {
    return { extractions: {}, error: true };
  }
  const extractions: Record<string, Extraction> = {};
  (data as Row[]).forEach((row) => {
    extractions[row.document_id] = toExtraction(row);
  });
  return { extractions, error: false };
}

export type StartResult =
  | 'processing'
  | 'done'
  | 'unreadable'
  | 'consent_required'
  | 'not_a_statement'
  | 'rate_limited'
  | 'error';

/** Asks the server to read a statement. Safe to call again: a document
 * that's already been read (or is being read) isn't read twice. */
export async function startExtraction(documentId: string): Promise<{ status: StartResult; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<{ status?: string; message?: string }>(
      'extract-document',
      { body: { document_id: documentId } }
    );
    if (!error) {
      const status = data?.status;
      return status === 'done' || status === 'unreadable' ? { status } : { status: 'processing' };
    }
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      let body: { status?: string; message?: string } | undefined;
      try {
        body = await response.json();
      } catch {
        // generic message below
      }
      const known: StartResult[] = ['consent_required', 'not_a_statement', 'rate_limited'];
      if (body?.status && known.includes(body.status as StartResult)) {
        return { status: body.status as StartResult, message: body.message };
      }
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

/** Answers one flagged transaction. The server then recalculates the
 * suggested income. */
export async function decideTransaction(
  transactionId: string,
  decision: TransactionDecision
): Promise<{ error: boolean }> {
  const { data, error } = await supabase
    .from('extracted_transactions')
    .update({ user_decision: decision })
    .eq('id', transactionId)
    .select('id');
  return { error: !!error || !data || data.length === 0 };
}

/** Gives (true) or withdraws (false) consent to AI reading. */
export async function setAiConsent(allow: boolean): Promise<{ error: boolean }> {
  const { error } = await supabase.rpc('set_ai_consent', { p_allow: allow });
  return { error: !!error };
}

// ─── Wording ────────────────────────────────────────────────────────────────

export const DECISION_OPTIONS: { value: TransactionDecision; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'own_transfer', label: 'My own transfer' },
  { value: 'refund', label: 'Refund' },
  { value: 'loan', label: 'Loan' },
  { value: 'reversal', label: 'Reversal' },
  { value: 'not_income', label: 'Other, not income' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2025-07-01" -> "1 Jul 2025" (no time zones involved). */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function formatPeriod(extraction: Extraction): string | null {
  if (!extraction.periodStart || !extraction.periodEnd) {
    return null;
  }
  return `${formatIsoDate(extraction.periodStart)} – ${formatIsoDate(extraction.periodEnd)}`;
}

/** An amount in the statement's own currency. */
export function formatStatementAmount(minor: number, currency: string | null): string {
  if (!currency || currency === 'NGN') {
    return formatNaira(minor);
  }
  const major = (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${major}`;
}

export function warningMessage(warning: ExtractionWarning, extraction: Extraction, taxYear: number): string {
  const period = formatPeriod(extraction);
  switch (warning) {
    case 'partial_year':
      return `This statement only covers ${period ?? 'part of the year'}. Add any income from the rest of ${taxYear} yourself.`;
    case 'wrong_year':
      return `This statement is for ${period ?? 'a different year'}, not ${taxYear}. Check you uploaded the right one.`;
    case 'period_unknown':
      return `We couldn’t see the statement period. Check the amount covers all of ${taxYear}.`;
    case 'foreign_currency':
      return `This statement is in ${extraction.currency}. Convert your ${taxYear} income to naira at the CBN rate and enter it yourself.`;
    case 'currency_unknown':
      return 'We couldn’t tell which currency this statement is in, so we haven’t filled in an amount.';
    case 'totals_mismatch':
      return 'The payments we found don’t add up to the statement’s own total. Check the amount carefully.';
    case 'no_income_found':
      return `We didn’t find any income for ${taxYear} in this statement.`;
    default:
      return '';
  }
}

/** Why a statement couldn't be read, in plain English. The user can always
 * type the amount instead. */
export function failureMessage(extraction: Extraction): string {
  switch (extraction.errorCode) {
    case 'password_protected':
      return 'This PDF is password-protected. Upload an unlocked copy, or type the amount.';
    case 'too_many_pages':
      return 'This statement has too many pages for us to read. Type the amount, or upload a shorter statement.';
    case 'unsupported_type':
      return 'We can’t read HEIC photos yet. Type the amount, or upload a PDF, JPG or PNG.';
    case 'file_too_large':
      return 'This photo is too large for us to read. Type the amount, or upload a smaller photo or a PDF.';
    case 'not_a_statement':
      return 'This doesn’t look like a statement, so we couldn’t read any income from it. Type the amount.';
    case 'unreadable':
    case 'corrupt_file':
      return 'We couldn’t read this file clearly. Type the amount, or upload a clearer copy.';
    case 'timeout':
      return 'Reading this statement took too long. Try again, or type the amount.';
    case 'provider_unavailable':
      return 'Our statement reader isn’t available right now. Try again later, or type the amount.';
    default:
      return 'We couldn’t read this statement. Try again, or type the amount.';
  }
}
