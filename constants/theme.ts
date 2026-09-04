/**
 * Shared design tokens: spacing, radii, typography, and layout constants.
 * Import `theme` (or the individual named exports) instead of hardcoding
 * numbers in component styles.
 */
import { Platform } from 'react-native';
import { colors } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const typography = {
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  /** Serif display face used for onboarding headlines (and the wordmark style). */
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '400' as const,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  },
} as const;

export const layout = {
  screenPadding: spacing.lg,
  maxContentWidth: 480,
} as const;

/**
 * Splash screen (Figma node 88:612): full-bleed dark frame with the FILEO
 * wordmark centered horizontally, offset from the top of the frame.
 */
export const splashLayout = {
  logoWidth: 140.765,
  logoHeight: 34.992,
  logoTop: 405,
} as const;

/**
 * Onboarding carousel (Figma nodes 88:663, 93:942, 90:921): a colored hero
 * panel (heading, body, illustration) above a white footer (progress dots
 * + CTA button), shared by steps 1-3.
 */
export const onboardingLayout = {
  dotSize: 8,
  activeDotWidth: 24,
  dotGap: spacing.sm,
  autoAdvanceMs: 4500,
  swipeThreshold: 50,
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  layout,
  splashLayout,
  onboardingLayout,
} as const;

export type Theme = typeof theme;
