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
  danger: '#D93025',

  overlay: 'rgba(17, 20, 23, 0.5)',
} as const;

export type ColorToken = keyof typeof colors;
