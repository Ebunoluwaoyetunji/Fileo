/**
 * Strict validation of a provider's output, then the sanity checks that turn
 * it into what we store. Pure functions (no I/O), so they're easy to test.
 *
 * Anything that doesn't match the schema exactly is rejected as a whole
 * ('invalid_output'); nothing is half-saved. The checks flag rather than
 * guess:
 *   - transactions should add up to the statement's printed total
 *   - the statement period vs the document's tax year (partial / wrong year)
 *   - a currency other than NGN is flagged, never converted
 *   - 'unsure' items in the tax year need the user's answer (needs_review)
 */
import {
  ExtractionError,
  type RawExtraction,
  PAYOUT_PLATFORMS,
  type RawTransaction,
  TRANSACTION_CATEGORIES,
  type TransactionCategory,
} from './types.ts';

/** Most credits a statement may list before we treat the output as broken. */
export const MAX_TRANSACTIONS = 2000;
/** ₦10bn per transaction / total, in major units (matches the database). */
const MAX_AMOUNT = 1_000_000_000_000;
/** Totals may differ by up to ₦1 (rounding on the statement) before we flag. */
const TOTALS_TOLERANCE_KOBO = 100;
const DESCRIPTION_MAX = 120;

const TOP_KEYS = [
  'currency',
  'is_statement',
  'period_end',
  'period_start',
  'readable',
  'total_inflows',
  'transactions',
];
const TRANSACTION_KEYS = ['amount', 'category', 'date', 'description', 'source_platform'];

function invalid(detail: string): never {
  // `detail` names the field only — never its value.
  throw new ExtractionError('invalid_output', `invalid output: ${detail}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, i) => key === keys[i]);
}

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Major units -> whole minor units (kobo), or null if it isn't a positive
 * amount with at most 2 decimal places. */
export function toKobo(amount: unknown): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return null;
  }
  const kobo = Math.round(amount * 100);
  if (Math.abs(amount * 100 - kobo) > 1e-6 * Math.max(1, Math.abs(amount))) {
    return null; // more than 2 decimal places
  }
  return kobo;
}

/** Validates the provider's structured output against the schema, exactly. */
export function validateRawExtraction(value: unknown): RawExtraction {
  if (!isPlainObject(value) || !hasExactKeys(value, TOP_KEYS)) {
    invalid('top-level shape');
  }
  const { readable, is_statement, period_start, period_end, currency, total_inflows, transactions } =
    value;
  if (typeof readable !== 'boolean') invalid('readable');
  if (typeof is_statement !== 'boolean') invalid('is_statement');
  if (period_start !== null && !isIsoDate(period_start)) invalid('period_start');
  if (period_end !== null && !isIsoDate(period_end)) invalid('period_end');
  if (period_start && period_end && period_start > period_end) invalid('period order');
  if (currency !== null && (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency))) {
    invalid('currency');
  }
  if (total_inflows !== null && total_inflows !== 0 && toKobo(total_inflows) === null) {
    invalid('total_inflows');
  }
  if (!Array.isArray(transactions) || transactions.length > MAX_TRANSACTIONS) {
    invalid('transactions');
  }
  const checked: RawTransaction[] = transactions.map((t, i) => {
    if (!isPlainObject(t) || !hasExactKeys(t, TRANSACTION_KEYS)) invalid(`transaction ${i} shape`);
    if (!isIsoDate(t.date)) invalid(`transaction ${i} date`);
    if (toKobo(t.amount) === null) invalid(`transaction ${i} amount`);
    if (typeof t.description !== 'string' || t.description.trim() === '' || t.description.length > 500) {
      invalid(`transaction ${i} description`);
    }
    if (!TRANSACTION_CATEGORIES.includes(t.category as TransactionCategory)) {
      invalid(`transaction ${i} category`);
    }
    if (t.source_platform !== null && !(PAYOUT_PLATFORMS as readonly unknown[]).includes(t.source_platform)) {
      invalid(`transaction ${i} source_platform`);
    }
    return t as unknown as RawTransaction;
  });
  if ((!readable || !is_statement) && checked.length > 0) {
    invalid('transactions on an unreadable document');
  }
  return {
    readable,
    is_statement,
    period_start: period_start as string | null,
    period_end: period_end as string | null,
    currency: currency === null ? null : (currency as string).toUpperCase(),
    total_inflows: total_inflows as number | null,
    transactions: checked,
  };
}

/** Short, single-line, with long digit runs (7+ digits: account, card and
 * phone numbers) masked to their last 4 digits. */
export function cleanDescription(text: string): string {
  const oneLine = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const masked = oneLine.replace(/\d[\d -]{5,}\d/g, (digits) => {
    const onlyDigits = digits.replace(/\D/g, '');
    return onlyDigits.length >= 7 ? `••••${onlyDigits.slice(-4)}` : digits;
  });
  const short = masked.length > DESCRIPTION_MAX ? `${masked.slice(0, DESCRIPTION_MAX - 1)}…` : masked;
  return short || 'Transaction';
}

export type ExtractionWarning =
  | 'partial_year'
  | 'wrong_year'
  | 'period_unknown'
  | 'foreign_currency'
  | 'currency_unknown'
  | 'totals_mismatch'
  | 'no_income_found';

export interface StoredTransaction {
  /** What the AI said. The server works out `category` from it and the
   * filing's platforms (a payout from another selected platform becomes
   * 'platform_payout'). */
  ai_category: TransactionCategory;
  source_platform: string | null;
  position: number;
  date: string;
  amount_kobo: number;
  description: string;
  category: TransactionCategory;
  needs_review: boolean;
}

export type BuiltExtraction =
  | { kind: 'unreadable'; code: 'unreadable' | 'not_a_statement' }
  | {
      kind: 'done';
      periodStart: string | null;
      periodEnd: string | null;
      currency: string | null;
      totalInflowsKobo: number;
      warnings: ExtractionWarning[];
      transactions: StoredTransaction[];
    };

/** Applies the sanity checks to validated output, for a document uploaded
 * for `taxYear`. The suggested income itself is worked out by the database
 * (recalculate_extraction_suggestion) from what's stored here. */
export function buildExtraction(raw: RawExtraction, taxYear: number): BuiltExtraction {
  if (!raw.readable) {
    return { kind: 'unreadable', code: 'unreadable' };
  }
  if (!raw.is_statement) {
    return { kind: 'unreadable', code: 'not_a_statement' };
  }

  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;
  const inYear = (date: string) => date >= yearStart && date <= yearEnd;

  const transactions: StoredTransaction[] = raw.transactions.map((t, index) => ({
    position: index,
    date: t.date,
    amount_kobo: toKobo(t.amount) as number,
    description: cleanDescription(t.description),
    ai_category: t.category,
    category: t.category,
    source_platform: t.source_platform,
    // Only unsure items that could count towards this year's income need an
    // answer; ones from other years are left as they are.
    needs_review: t.category === 'unsure' && inYear(t.date),
  }));

  const warnings = new Set<ExtractionWarning>();

  // Period vs tax year.
  if (!raw.period_start || !raw.period_end) {
    warnings.add('period_unknown');
  } else if (raw.period_end < yearStart || raw.period_start > yearEnd) {
    warnings.add('wrong_year');
  } else if (raw.period_start > yearStart || raw.period_end < yearEnd) {
    warnings.add('partial_year');
  }
  if (transactions.length > 0 && !transactions.some((t) => inYear(t.date))) {
    warnings.add('wrong_year');
    warnings.delete('partial_year');
  }

  // Currency: flag, never convert.
  if (raw.currency === null) {
    warnings.add('currency_unknown');
  } else if (raw.currency !== 'NGN') {
    warnings.add('foreign_currency');
  }

  // Totals.
  const sumKobo = transactions.reduce((sum, t) => sum + t.amount_kobo, 0);
  let totalInflowsKobo = sumKobo;
  if (raw.total_inflows !== null) {
    totalInflowsKobo = raw.total_inflows === 0 ? 0 : (toKobo(raw.total_inflows) as number);
    if (Math.abs(totalInflowsKobo - sumKobo) > TOTALS_TOLERANCE_KOBO) {
      warnings.add('totals_mismatch');
    }
  }

  if (
    !transactions.some((t) => inYear(t.date) && (t.category === 'income' || t.needs_review)) &&
    !warnings.has('wrong_year')
  ) {
    warnings.add('no_income_found');
  }

  return {
    kind: 'done',
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
    currency: raw.currency,
    totalInflowsKobo,
    warnings: [...warnings],
    transactions,
  };
}
