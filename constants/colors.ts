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
  warning: '#B8860B',
  warningLight: '#EFE7D8',
  danger: '#D93025',

  overlay: 'rgba(17, 20, 23, 0.5)',

  // Flat tints (no gradients) for layered, shadow-free surfaces.
  offWhite: '#FAFAF8',
  /** ~6% forest green on off-white: hero areas. */
  greenTint: '#ECF2EE',
  /** Thin outlines that need to read on white (timeline markers). */
  mutedStroke: '#B8BFC6',
  /** Track of a segmented control. */
  track: '#EDEFEC',
  /** Calm "needs attention" (not an error). */
  amberTint: '#FBF4E6',
  amberBorder: '#EEDDB9',
  amberText: '#7A5310',

  // Onboarding hero gradients (steps 1 and 3 fade down into `background`).
  forestDeep: '#2C5A48',
  goldSoft: '#F0CB8E',
} as const;

export type ColorToken = keyof typeof colors;
