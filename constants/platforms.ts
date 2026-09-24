/**
 * Static catalog for the filing flow's platform selection (Figma: "Select
 * all the platforms you received payments from"). Mock/local only — no
 * real bank or platform integration.
 */
export type PlatformCategory = {
  title: string;
  platforms: string[];
};

export const PLATFORM_CATEGORIES: PlatformCategory[] = [
  {
    title: 'International platforms',
    platforms: ['Payoneer', 'PayPal', 'Deel', 'Upwork', 'Fiverr', 'Stripe'],
  },
  {
    title: 'Nigerian fintechs',
    platforms: ['Paystack', 'Flutterwave', 'Moniepoint', 'Opay', 'PalmPay', 'Others'],
  },
  {
    title: 'Content & creator',
    platforms: ['YouTube', 'TikTok', 'Substack', 'Patreon', 'Instagram', 'Selar', 'Others'],
  },
];

/** Shown on the "Other Nigerian Fintechs" drill-down (Figma frame) when
 * "Others" is tapped under Nigerian fintechs specifically — no equivalent
 * frame was provided for the other two categories' "Others" tile, so those
 * stay plain toggle chips. */
export const NIGERIAN_BANKS = [
  'Zenith bank',
  'Firstbank of Nigeria',
  'UBA',
  'Guaranty Trust Bank',
  'Nexapay',
  'FairMoney',
  'Wema Bank',
  'Stanbic IBTC (Standard chartered bank)',
  'Union Bank',
  'VFD Group',
  'Pocketmoney',
  'Access Bank',
];

export function isNigerianBank(name: string): boolean {
  return NIGERIAN_BANKS.includes(name);
}

/** Shown inline under a selected bank. Automatic bank connections don't
 * exist yet, so a bank works like any other income source: the user uploads
 * its statement (which Fileo can read for them) and confirms the amount. */
/** Shown where banks are chosen: payouts from platforms into a bank are
 * already counted under the platform, so adding the bank just for those
 * would count the same money twice. */
export const BANK_PAYOUTS_TIP =
  'Only add your bank if you also receive money there directly, not just payouts from the platforms above.';

export const BANK_STATEMENT_MESSAGE =
  'Upload a statement for this account. Automatic bank connection is coming soon.';

const NIGERIAN_FINTECHS =
  PLATFORM_CATEGORIES.find((category) => category.title === 'Nigerian fintechs')?.platforms ?? [];

/** How a platform's uploaded statement is filed in Documents: bank and
 * Nigerian fintech statements as bank statements, everything else (other
 * platforms, creator earnings) as other. */
export function platformDocumentCategory(platform: string): 'bank_statement' | 'other' {
  return isNigerianBank(platform) || NIGERIAN_FINTECHS.includes(platform) ? 'bank_statement' : 'other';
}

/** What a platform's document is called, e.g. "Paystack statement". */
export function platformDocumentLabel(platform: string): string {
  return `${platform} statement`;
}
