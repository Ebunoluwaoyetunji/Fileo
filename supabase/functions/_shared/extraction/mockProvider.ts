/**
 * Fake provider for development and testing. No network calls, no cost.
 *
 * It returns a realistic statement for the document's tax year. Words in
 * the uploaded file's name pick a test case, so every state can be tried in
 * Expo Go (words can be combined, e.g. "partial-year-has-unsure.pdf"):
 *
 *   (none)           a clean full-year naira statement: 12 payouts plus an own
 *                    transfer, a refund and a loan (none of which count)
 *   has-unsure       adds 3 transactions the AI isn't sure about (flagged)
 *   partial-year     covers only 1 Jul – 31 Dec of the tax year
 *   wrong-year       covers the year before the tax year
 *   usd              the statement is in US dollars
 *   mismatch         the printed total doesn't match the transactions
 *   no-period        no statement period printed
 *   unreadable       the "AI" says the file is too blurry to read
 *   not-statement    the "AI" says it isn't a statement (e.g. a receipt)
 *   password         treated as a password-protected PDF
 *   too-many-pages   treated as a PDF with too many pages
 *   timeout          the "AI" takes too long
 *   provider-down    the "AI" service is unavailable
 *   bad-output       the "AI" returns output that fails validation
 *   slow             takes 8 seconds (to see "Reading your statement…")
 *
 * Every mock read takes about 2 seconds. Token counts are reported as 0.
 */
import { ExtractionError, type ExtractionProvider, type RawExtraction, type RawTransaction } from './types.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Monthly payouts, naira. Sum: 4,180,500.50. */
export const MOCK_MONTHLY_INCOME = [
  320000, 285000, 410000, 350000, 298500.5, 372000, 415000, 260000, 390000, 445000, 305000, 330000,
];
/** Flagged ("unsure") items added by has-unsure, naira. */
export const MOCK_UNSURE = [
  { month: 3, day: 14, amount: 150000, description: 'Transfer from A. Bello' },
  { month: 8, day: 2, amount: 85000, description: 'Inward transfer' },
  { month: 11, day: 20, amount: 40000, description: 'Cash deposit - branch' },
];

const pad = (n: number) => String(n).padStart(2, '0');

function buildStatement(year: number, flags: Set<string>): RawExtraction {
  const partial = flags.has('partial-year');
  const firstMonth = partial ? 7 : 1;
  const transactions: RawTransaction[] = [];

  MOCK_MONTHLY_INCOME.forEach((amount, i) => {
    const month = i + 1;
    if (month >= firstMonth) {
      transactions.push({
        date: `${year}-${pad(month)}-${pad(Math.min(25, 3 + i * 2))}`,
        amount,
        description: `Payout settlement ${year}${pad(month)} to acct 0123456789`,
        category: 'income',
      });
    }
  });
  const extras: RawTransaction[] = [
    { date: `${year}-${pad(Math.max(firstMonth, 4))}-10`, amount: 200000, description: 'Transfer from own savings', category: 'own_transfer' },
    { date: `${year}-${pad(Math.max(firstMonth, 6))}-18`, amount: 12500, description: 'Refund - online purchase', category: 'refund' },
    { date: `${year}-${pad(Math.max(firstMonth, 9))}-05`, amount: 500000, description: 'Loan disbursement', category: 'loan' },
  ];
  transactions.push(...extras);
  if (flags.has('has-unsure')) {
    for (const item of MOCK_UNSURE) {
      const month = Math.max(firstMonth, item.month);
      transactions.push({
        date: `${year}-${pad(month)}-${pad(item.day)}`,
        amount: item.amount,
        description: item.description,
        category: 'unsure',
      });
    }
  }
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  const sum = transactions.reduce((total, t) => total + Math.round(t.amount * 100), 0) / 100;
  return {
    readable: true,
    is_statement: true,
    period_start: flags.has('no-period') ? null : `${year}-${pad(firstMonth)}-01`,
    period_end: flags.has('no-period') ? null : `${year}-12-31`,
    currency: flags.has('usd') ? 'USD' : 'NGN',
    total_inflows: flags.has('mismatch') ? sum + 100000 : sum,
    transactions,
  };
}

export const mockProvider: ExtractionProvider = {
  name: 'mock',

  model() {
    return 'mock';
  },

  async extract({ fileName, taxYear }) {
    const name = fileName.toLowerCase();
    const flags = new Set(
      [
        'has-unsure',
        'partial-year',
        'wrong-year',
        'usd',
        'mismatch',
        'no-period',
        'unreadable',
        'not-statement',
        'password',
        'too-many-pages',
        'timeout',
        'provider-down',
        'bad-output',
        'slow',
      ].filter((flag) => name.includes(flag))
    );

    await sleep(flags.has('slow') ? 8000 : 2000);

    if (flags.has('password')) throw new ExtractionError('password_protected', 'mock');
    if (flags.has('too-many-pages')) throw new ExtractionError('too_many_pages', 'mock');
    if (flags.has('timeout')) throw new ExtractionError('timeout', 'mock');
    if (flags.has('provider-down')) throw new ExtractionError('provider_unavailable', 'mock');

    let output: unknown;
    if (flags.has('unreadable') || flags.has('not-statement')) {
      output = {
        readable: !flags.has('unreadable'),
        is_statement: !flags.has('not-statement'),
        period_start: null,
        period_end: null,
        currency: null,
        total_inflows: null,
        transactions: [],
      };
    } else if (flags.has('bad-output')) {
      output = { readable: true, transactions: 'not a list' };
    } else {
      output = buildStatement(flags.has('wrong-year') ? taxYear - 1 : taxYear, flags);
    }
    return { output, model: 'mock', inputTokens: 0, outputTokens: 0 };
  },
};
