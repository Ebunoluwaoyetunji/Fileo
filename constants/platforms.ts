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
    platforms: ['YouTube', 'TikTok', 'Substack', 'Patreon', 'Instagram', 'Others'],
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

/** Shown inline under a selected bank — the only entries Upload Documents
 * treats as auto-pullable (isNigerianBank), so the message is scoped to
 * match: it doesn't appear on Nigerian fintech tiles like Paystack, which
 * the Upload Documents frame itself shows needing a manual upload. */
export const AUTO_PULL_MESSAGE = 'FILEO can automatically pull income data from this account.';
