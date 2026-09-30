/**
 * When each tax year's return is due, as a date (YYYY-MM-DD, Lagos time).
 * One line per tax year: change a date here and Home's deadline pill and
 * "When your return is due" follow. A year that isn't listed shows no
 * deadline rather than a guessed one.
 */
export const FILING_DEADLINES: Record<number, string> = {
  2024: '2025-03-31',
  2025: '2026-03-31',
  2026: '2027-03-31',
};

/** The deadline for a tax year, as the end of that day (Lagos, UTC+1). */
export function filingDeadline(taxYear: number): Date | null {
  const date = FILING_DEADLINES[taxYear];
  return date ? new Date(`${date}T23:59:59+01:00`) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until the deadline (negative once it has passed). */
export function daysUntil(deadline: Date, now: Date = new Date()): number {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 0);
  return Math.round((deadline.getTime() - endOfToday.getTime()) / DAY_MS);
}

/** "31 Mar 2026". */
export const formatDeadline = (deadline: Date) =>
  deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

/** "31 March 2026". */
export const formatDeadlineLong = (deadline: Date) =>
  deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
