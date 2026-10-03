/**
 * FILEO color palette.
 * Keep all raw color values here — components and screens should reference
 * `colors.<token>` rather than hex codes directly.
 */
export const colors = {
  primary: '#0B6E4F',
  primaryDark: '#074D37',
  primaryLight: '#E3F3EC',
  accent: '#208AEF',

  background: '#FFFFFF',
  backgroundInverse: '#0B1628',
  surface: '#F7F8FA',
  border: '#E4E7EB',

  textPrimary: '#111417',
  textSecondary: '#5B6470',
  textInverse: '#FFFFFF',

  success: '#1E8E3E',
  /** Background of "Completed" / "Submitted" status pills. */
  successTint: '#DCEFE3',
  warning: '#B8860B',
  warningLight: '#EFE7D8',
  danger: '#D93025',

  overlay: 'rgba(17, 20, 23, 0.5)',

  // Buttons. Every primary button uses primaryButton (navy); green is the
  // accent (success, savings, positive amounts, ticks, highlights), not a
  // button colour. White on navy: 18:1; white on danger: 4.8:1 (AA).
  primaryButton: '#0B1628',
  onPrimaryButton: '#FFFFFF',
  /** Disabled buttons: flat grey with dark grey text (4.9:1), not faded. */
  disabledSurface: '#E6E9ED',

  // On navy (backgroundInverse) surfaces. `primary` green is only 2.9:1 on
  // navy, so green there uses the lighter primaryOnDark (8.7:1).
  primaryOnDark: '#5FC79B',
  /** Secondary text on navy: white at 70% (9.2:1). */
  textOnDarkMuted: 'rgba(255, 255, 255, 0.7)',
  /** Faint marks on navy (ring track, skeletons): white at 15%. */
  faintOnDark: 'rgba(255, 255, 255, 0.15)',

  // Flat tints (no gradients) for layered, shadow-free surfaces.
  offWhite: '#FAFAF8',
  /** ~6% forest green on off-white: hero / top summary areas, and the soft
   * circles behind list-row icons. */
  heroTint: '#ECF2EE',
  /** Thin outlines that need to read on white (timeline markers). */
  mutedStroke: '#B8BFC6',
  /** Track of a segmented control. */
  track: '#EDEFEC',
  /** Calm "needs attention" (not an error). */
  amberTint: '#FBF4E6',
  amberBorder: '#EEDDB9',
  amberText: '#7A5310',

  /** Warm gold for small highlights (Home's attention ring). */
  goldSoft: '#F0CB8E',

  /** Onboarding hero: brand navy (`backgroundInverse`) easing to this, then into the sheet. */
  heroNavyEnd: '#17294A',
  /** Onboarding ring on navy (white at 30%), and a light outline for dark shapes on a dark hero. */
  ringOnDark: 'rgba(255, 255, 255, 0.3)',
  outlineOnDark: 'rgba(255, 255, 255, 0.35)',

  // Onboarding illustration badges: an icon colour with the pale tint in the
  // badge's centre. Indigo is the tax-form badge on step 1; navy, green and
  // gold reuse the brand navy, `primary` and `warning`.
  indigo: '#2A1A78',
  indigoTint: '#E6E1FA',
  navyTint: '#E5EAF2',
} as const;

export type ColorToken = keyof typeof colors;
