/**
 * Shared look and motion for the three onboarding illustrations, so the
 * screens can't drift apart. Every illustration is drawn in a square of side
 * `side` (see IllustrationCanvas), and sizes here are fractions of that side.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { colors } from '../../constants/colors';

export const onboardingArt = {
  /** Badge diameter and its icon, as fractions of the side / the badge. */
  badgeFraction: 0.26,
  iconFraction: 0.36,
  /** The lower part of every drawing sinks into white: this share of the side, eased. */
  sinkFraction: 0.32,
  /** Ring and connecting lines. */
  lineWidth: 1.5,
  dotRadius: 3.5,
  /** Screen 2: one turn of the orbit. */
  orbitMs: 22000,
  /** Screens 1 and 3: one gentle float up and back down. */
  floatMs: 6000,
  floatDistance: 4,
  /** Screen 3: digits turning into dots one by one, then the seal popping on. */
  maskStepMs: 90,
  maskFadeMs: 160,
  maskStartDelayMs: 450,
  popMs: 420,
} as const;

/** Icon colour and the pale tint that goes with it (DESIGN.md: onboarding badges). */
export const badgeTones = {
  navy: { icon: colors.backgroundInverse, tint: colors.navyTint },
  indigo: { icon: colors.indigo, tint: colors.indigoTint },
  gold: { icon: colors.warning, tint: colors.amberTint },
  green: { icon: colors.primary, tint: colors.primaryLight },
} as const;

export type BadgeTone = keyof typeof badgeTones;

/**
 * Web has no native animation driver: a native-driver loop there falls back
 * to JS and plays only once, so web uses the JS driver throughout.
 */
export const useNativeDriver = Platform.OS !== 'web';

export function badgeSizeFor(side: number) {
  return Math.round((side * onboardingArt.badgeFraction) / 2) * 2;
}

export function iconSizeFor(side: number) {
  return Math.round((badgeSizeFor(side) * onboardingArt.iconFraction) / 2) * 2;
}

/** The system reduce-motion setting; null until it is known. */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((value) => {
        if (!cancelled) {
          setReduceMotion(value);
        }
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}
