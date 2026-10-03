/**
 * Onboarding step 2: four icon badges orbiting a ring, one per filing step
 * (add income, upload statements, claim deductions, review and submit).
 * Same pattern and motion as the original artwork, drawn as vector so it
 * stays crisp at every size: a thin continuous ring, four evenly spaced dots,
 * and four light badges with a soft tinted centre.
 *
 * The whole ring turns clockwise once every 22s; each badge counter-rotates
 * so its icon stays upright. With reduce motion on, it holds still.
 */
import { CircleCheck, FileUp, Percent, Wallet, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

const ORBIT_DURATION_MS = 22000;
/** Ring radius and badge diameter, as fractions of the drawing's side. */
const RADIUS_FRACTION = 0.36;
const BADGE_SIZE_FRACTION = 0.26;
const RING_WIDTH = 1.5;
const DOT_RADIUS = 3.5;
/** Icon size as a fraction of the badge, the same in all four. */
const ICON_FRACTION = 0.36;

/** Clockwise from 12 o'clock, in the order a return is filed. */
const badges: { key: string; icon: LucideIcon; color: string; tint: string; angle: number }[] = [
  { key: 'income', icon: Wallet, color: colors.backgroundInverse, tint: colors.navyTint, angle: 315 },
  { key: 'upload', icon: FileUp, color: colors.indigo, tint: colors.indigoTint, angle: 45 },
  { key: 'deductions', icon: Percent, color: colors.warning, tint: colors.amberTint, angle: 135 },
  { key: 'submit', icon: CircleCheck, color: colors.primary, tint: colors.primaryLight, angle: 225 },
];
/** The dots sit halfway between the badges. */
const dotAngles = [0, 90, 180, 270];

function pointOnRing(center: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: center + radius * Math.sin(rad), y: center - radius * Math.cos(rad) };
}

function Step2Illustration() {
  const spin = useRef(new Animated.Value(0)).current;
  const [side, setSide] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ORBIT_DURATION_MS,
        easing: Easing.linear,
        // Web has no native driver: there, a native-driver loop falls back to
        // JS and plays only once, so it keeps turning only with the JS driver.
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    const apply = (reduceMotion: boolean) => {
      if (reduceMotion) {
        loop.stop();
        spin.setValue(0);
      } else {
        loop.start();
      }
    };
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (!cancelled) {
          apply(reduceMotion);
        }
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', apply);
    return () => {
      cancelled = true;
      subscription.remove();
      loop.stop();
    };
  }, [spin]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // an even whole number keeps the centre on a pixel boundary
    setSide(Math.floor(Math.min(width, height) / 2) * 2);
  };

  const center = side / 2;
  const radius = Math.round(side * RADIUS_FRACTION);
  const badgeSize = Math.round((side * BADGE_SIZE_FRACTION) / 2) * 2;
  const iconSize = Math.round((badgeSize * ICON_FRACTION) / 2) * 2;
  const orbit = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const upright = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <View
      style={styles.fill}
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {side > 0 ? (
        <Animated.View style={{ width: side, height: side, transform: [{ rotate: orbit }] }}>
          <Svg width={side} height={side} style={StyleSheet.absoluteFill}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.faintOnDark}
              strokeWidth={RING_WIDTH}
              fill="none"
            />
            {dotAngles.map((angle) => {
              const { x, y } = pointOnRing(center, radius, angle);
              return <Circle key={angle} cx={x} cy={y} r={DOT_RADIUS} fill={colors.textOnDarkMuted} />;
            })}
          </Svg>
          {badges.map((badge) => {
            const { x, y } = pointOnRing(center, radius, badge.angle);
            const Icon = badge.icon;
            return (
              <Animated.View
                key={badge.key}
                style={[
                  styles.badge,
                  {
                    width: badgeSize,
                    height: badgeSize,
                    left: x - badgeSize / 2,
                    top: y - badgeSize / 2,
                    transform: [{ rotate: upright }],
                  },
                ]}
              >
                <Svg width={badgeSize} height={badgeSize} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <RadialGradient id={`onboarding-badge-${badge.key}`} cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={badge.tint} />
                      <Stop offset="0.85" stopColor={colors.background} />
                    </RadialGradient>
                  </Defs>
                  <Circle
                    cx={badgeSize / 2}
                    cy={badgeSize / 2}
                    r={badgeSize / 2}
                    fill={`url(#onboarding-badge-${badge.key})`}
                  />
                </Svg>
                {/* its own view, so it paints above the absolutely positioned disc on web */}
                <View>
                  <Icon size={iconSize} color={badge.color} />
                </View>
              </Animated.View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function OnboardingStepTwo() {
  return (
    <OnboardingScreen
      step={2}
      heading="File in Four Simple Steps"
      body="Add your income, upload your statements, claim your deductions, then review and submit."
      illustration={<Step2Illustration />}
      background={{ colors: [colors.backgroundInverse] }}
      headingColor={colors.textInverse}
      bodyColor={colors.textInverse}
      activeDotColor={colors.backgroundInverse}
      nextRoute="/(onboarding)/step-3"
      prevRoute="/(onboarding)/step-1"
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
