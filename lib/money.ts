/**
 * Money in the app is whole kobo (integers), the same as the database. Naira
 * text the user types is parsed straight to kobo without floating point, and
 * amounts are formatted with thousands separators.
 */

/** Largest amount accepted per field: ₦10,000,000,000 (matches the database). */
export const MAX_AMOUNT_KOBO = 1_000_000_000_000;

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "₦4,820,000" or, when there are kobo, "₦1,234,567.89". */
export function formatNaira(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(kobo));
  const naira = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${sign}₦${groupThousands(String(naira))}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** Naira text for an input field, e.g. 482000000 -> "4,820,000". */
export function koboToInput(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) {
    return '';
  }
  const naira = Math.floor(kobo / 100);
  const rest = kobo % 100;
  return `${groupThousands(String(naira))}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}

/** Formats as the user types: digits with commas, at most 2 decimal places.
 * Anything else (letters, a minus sign, a second point) is dropped. */
export function formatNairaInput(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  const wholeDigits = whole.replace(/^0+(?=\d)/, '');
  const grouped = groupThousands(wholeDigits);
  if (rest.length === 0) {
    return grouped;
  }
  return `${grouped || '0'}.${rest.join('').slice(0, 2)}`;
}

/** Naira text -> whole kobo, or null if it isn't a valid amount. */
export function parseNairaInput(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) {
    return null;
  }
  const whole = match[1].replace(/^0+(?=\d)/, '');
  if (whole.length > 13) {
    return Number.MAX_SAFE_INTEGER; // way over the limit; reported as too large
  }
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return Number(whole) * 100 + Number(fraction);
}

export type AmountCheck = { kobo: number; error: null } | { kobo: null; error: string };

/** Validates an amount field: required, a number, not over the maximum. */
export function checkAmount(text: string, emptyMessage: string): AmountCheck {
  if (!text.trim()) {
    return { kobo: null, error: emptyMessage };
  }
  const kobo = parseNairaInput(text);
  if (kobo === null) {
    return { kobo: null, error: 'Enter an amount in naira, like 250,000.' };
  }
  if (kobo > MAX_AMOUNT_KOBO) {
    return { kobo: null, error: `That's more than we can accept here (up to ${formatNaira(MAX_AMOUNT_KOBO)}).` };
  }
  return { kobo, error: null };
}
