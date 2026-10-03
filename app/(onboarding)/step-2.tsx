/**
 * Onboarding step 2: five icon badges orbiting a ring, one per step of the
 * filing flow (lib/filings.ts FILING_STEPS: choose where you earn, upload
 * statements, confirm income, add deductions, review and submit), so the
 * count matches Home. Drawn as vector so it stays crisp at every size: a thin
 * continuous ring, evenly spaced dots, and the onboarding badges.
 *
 * The whole ring turns clockwise once every 22s; each badge counter-rotates
 * so its icon stays upright. With reduce motion on, it holds still.
 */
import { CircleCheck, FileUp, ListChecks, Percent, Wallet, type LucideIcon } from 'lucide-react-native';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import {
  BadgeTone,
  badgeSizeFor,
  iconSizeFor,
  onboardingArt,
  useReduceMotion,
} from '../../components/onboarding/art';
import { IllustrationCanvas } from '../../components/onboarding/IllustrationCanvas';
import { useLoopClock } from '../../components/onboarding/motion';
import { OnboardingBadge } from '../../components/onboarding/OnboardingBadge';
import { colors } from '../../constants/colors';

/** Ring radius as a fraction of the side. */
const RADIUS_FRACTION = 0.36;

/** One per filing step, clockwise in the order a return is filed. */
const steps: { key: string; icon: LucideIcon; tone: BadgeTone }[] = [
  { key: 'income', icon: Wallet, tone: 'navy' },
  { key: 'upload', icon: FileUp, tone: 'indigo' },
  { key: 'confirm', icon: ListChecks, tone: 'navy' },
  { key: 'deductions', icon: Percent, tone: 'gold' },
  { key: 'submit', icon: CircleCheck, tone: 'green' },
];
/** Evenly spaced, the first just left of 12 o'clock; the dots sit halfway between. */
const SPACING = 360 / steps.length;
const badges = steps.map((step, i) => ({ ...step, angle: (360 - SPACING / 2 + i * SPACING) % 360 }));
const dotAngles = steps.map((_, i) => i * SPACING);

function pointOnRing(center: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: center + radius * Math.sin(rad), y: center - radius * Math.cos(rad) };
}

function Orbit({ side }: { side: number }) {
  const reduceMotion = useReduceMotion();
  const clock = useLoopClock(onboardingArt.orbitMs, reduceMotion === false);

  const center = side / 2;
  const radius = Math.round(side * RADIUS_FRACTION);
  const badgeSize = badgeSizeFor(side);
  const iconSize = iconSizeFor(side);
  const orbit = clock.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const upright = clock.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <Animated.View style={{ width: side, height: side, transform: [{ rotate: orbit }] }}>
      <Svg width={side} height={side} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.ringOnDark}
          strokeWidth={onboardingArt.lineWidth}
          fill="none"
        />
        {dotAngles.map((angle) => {
          const { x, y } = pointOnRing(center, radius, angle);
          return <Circle key={angle} cx={x} cy={y} r={onboardingArt.dotRadius} fill={colors.textOnDarkMuted} />;
        })}
      </Svg>
      {badges.map((badge) => {
        const { x, y } = pointOnRing(center, radius, badge.angle);
        return (
          <Animated.View
            key={badge.key}
            style={[
              styles.badge,
              { left: x - badgeSize / 2, top: y - badgeSize / 2, transform: [{ rotate: upright }] },
            ]}
          >
            <OnboardingBadge icon={badge.icon} tone={badge.tone} size={badgeSize} iconSize={iconSize} />
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

export default function OnboardingStepTwo() {
  return (
    <OnboardingScreen
      step={2}
      heading="File in Five Simple Steps"
      body="Choose where you earn, upload your statements, confirm your income, add your deductions, then review and submit."
      illustration={<IllustrationCanvas>{(side) => <Orbit side={side} />}</IllustrationCanvas>}
      nextRoute="/(onboarding)/step-3"
      prevRoute="/(onboarding)/step-1"
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
  },
});
