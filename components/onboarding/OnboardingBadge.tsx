/**
 * The onboarding badge: one Lucide icon on a disc, in one of four tones.
 *
 * - `disc` (default): a white disc with the tone's tint soft in the centre,
 *   for badges that sit on the hero.
 * - `solid`: a flat disc in the tint, for icons inside a white card.
 *
 * The icon is always `iconSizeFor(side)`, so it matches across screens.
 */
import type { LucideIcon } from 'lucide-react-native';
import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { BadgeTone, badgeTones } from './art';

type Props = {
  icon: LucideIcon;
  tone: BadgeTone;
  /** Disc diameter. */
  size: number;
  iconSize: number;
  variant?: 'disc' | 'solid';
};

export function OnboardingBadge({ icon: Icon, tone, size, iconSize, variant = 'disc' }: Props) {
  const { icon, tint } = badgeTones[tone];
  // SVG ids must be unique on the page and safe inside url(#…)
  const gradientId = `onboarding-badge-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = size / 2;

  return (
    <View style={[styles.badge, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {variant === 'disc' ? (
          <Defs>
            <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tint} />
              <Stop offset="0.85" stopColor={colors.background} />
            </RadialGradient>
          </Defs>
        ) : null}
        <Circle cx={r} cy={r} r={r} fill={variant === 'disc' ? `url(#${gradientId})` : tint} />
      </Svg>
      {/* its own view, so it paints above the absolutely positioned disc on web */}
      <View>
        <Icon size={iconSize} color={icon} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
