// Unit tests for the strict validator and sanity checks used by
// extract-document. Run with Deno (not needed for deploying):
//   deno test supabase/tests/extraction/validate_test.ts
import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import {
  buildExtraction,
  cleanDescription,
  toKobo,
  validateRawExtraction,
} from '../../functions/_shared/extraction/validate.ts';
import { ExtractionError, type RawExtraction } from '../../functions/_shared/extraction/types.ts';

const good = (): RawExtraction => ({
  readable: true,
  is_statement: true,
  period_start: '2025-01-01',
  period_end: '2025-12-31',
  currency: 'NGN',
  total_inflows: 650000.25,
  transactions: [
    { date: '2025-02-03', amount: 400000, description: 'Client payment', category: 'income', source_platform: null },
    { date: '2025-05-09', amount: 250000.25, description: 'PAYSTACK SETTLEMENT', category: 'income', source_platform: 'Paystack' },
  ],
});

const invalid = (value: unknown) =>
  assertThrows(() => validateRawExtraction(value), ExtractionError, 'invalid output');

Deno.test('accepts output that matches the schema exactly', () => {
  assertEquals(validateRawExtraction(good()).transactions.length, 2);
});

Deno.test('rejects anything that does not match exactly', () => {
  invalid(null);
  invalid('text');
  invalid({ ...good(), extra: 1 });
  const { currency: _c, ...missing } = good();
  invalid(missing);
  invalid({ ...good(), readable: 'yes' });
  invalid({ ...good(), period_start: '2025-02-30' }); // not a real date
  invalid({ ...good(), period_start: '2025-12-31', period_end: '2025-01-01' });
  invalid({ ...good(), currency: 'naira' });
  invalid({ ...good(), transactions: 'none' });
  const tx = (t: Record<string, unknown>) => ({ ...good(), transactions: [{ ...good().transactions[0], ...t }] });
  invalid(tx({ amount: -5 }));
  invalid(tx({ amount: 0 }));
  invalid(tx({ amount: 10.123 })); // 3 decimals
  invalid(tx({ amount: '1000' }));
  invalid(tx({ amount: 2e12 })); // over ₦10bn
  invalid(tx({ date: '03/02/2025' }));
  invalid(tx({ category: 'salary' }));
  invalid(tx({ description: '' }));
  invalid(tx({ note: 'extra key' }));
  invalid(tx({ source_platform: 'Some Bank' })); // not a known platform
  const { source_platform: _s, ...noSource } = good().transactions[0];
  invalid({ ...good(), transactions: [noSource] }); // key missing
  invalid({ ...good(), readable: false }); // transactions on an unreadable file
});

Deno.test('money becomes whole kobo', () => {
  assertEquals(toKobo(250000.25), 25000025);
  assertEquals(toKobo(0.1 + 0.2), 30);
  assertEquals(toKobo(10.123), null);
});

Deno.test('descriptions are short and mask account, card and phone numbers', () => {
  assertEquals(cleanDescription('Transfer from 0123456789 ref'), 'Transfer from ••••6789 ref');
  assertEquals(cleanDescription('Card 5399 8312 3456 7890'), 'Card ••••7890');
  assertEquals(cleanDescription('Invoice 202501'), 'Invoice 202501'); // 6 digits kept
  assertEquals(cleanDescription('a\nb\tc'), 'a b c');
  assertEquals(cleanDescription('x'.repeat(200)).length, 120);
});

Deno.test('a clean full-year naira statement has no warnings', () => {
  const built = buildExtraction(validateRawExtraction(good()), 2025);
  if (built.kind !== 'done') throw new Error('expected done');
  assertEquals(built.warnings, []);
  assertEquals(built.totalInflowsKobo, 65000025);
});

Deno.test('flags rather than guesses', () => {
  const warningsFor = (patch: Partial<RawExtraction>, year = 2025) => {
    const built = buildExtraction(validateRawExtraction({ ...good(), ...patch }), year);
    return built.kind === 'done' ? built.warnings.sort() : built.code;
  };
  assertEquals(warningsFor({ period_start: '2025-07-01' }), ['partial_year']);
  assertEquals(warningsFor({}, 2026), ['wrong_year']);
  assertEquals(warningsFor({ period_start: null }), ['period_unknown']);
  assertEquals(warningsFor({ currency: 'USD' }), ['foreign_currency']);
  assertEquals(warningsFor({ currency: null }), ['currency_unknown']);
  assertEquals(warningsFor({ total_inflows: 650001 }), []); // within ₦1
  assertEquals(warningsFor({ total_inflows: 700000 }), ['totals_mismatch']);
  assertEquals(warningsFor({ total_inflows: null }), []); // nothing printed: our sum is used
  assertEquals(warningsFor({ transactions: [] , total_inflows: null }), ['no_income_found']);
  assertEquals(warningsFor({ readable: false, transactions: [] }), 'unreadable');
  assertEquals(warningsFor({ is_statement: false, transactions: [] }), 'not_a_statement');
});

Deno.test('only unsure items in the tax year need the user', () => {
  const raw = validateRawExtraction({
    ...good(),
    transactions: [
      { date: '2025-03-01', amount: 100, description: 'a', category: 'unsure', source_platform: null },
      { date: '2024-12-31', amount: 100, description: 'b', category: 'unsure', source_platform: null },
      { date: '2025-03-02', amount: 100, description: 'c', category: 'own_transfer', source_platform: null },
    ],
    total_inflows: 300,
  });
  const built = buildExtraction(raw, 2025);
  if (built.kind !== 'done') throw new Error('expected done');
  assertEquals(built.transactions.map((t) => t.needs_review), [true, false, false]);
});

Deno.test('keeps where a payout came from; the server decides if it is already counted', () => {
  const built = buildExtraction(validateRawExtraction(good()), 2025);
  if (built.kind !== 'done') throw new Error('expected done');
  assertEquals(built.transactions.map((t) => [t.ai_category, t.category, t.source_platform]), [
    ['income', 'income', null],
    ['income', 'income', 'Paystack'],
  ]);
});
