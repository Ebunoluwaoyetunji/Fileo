/**
 * Onboarding step 2 — Figma node 93:942 ("File in Four Simple Steps").
 * Illustration: 4 icon badges (document, checkmark, party-popper, ₦) orbit
 * slowly around a dotted ring "track", each staying upright as it travels —
 * an animated take on the static Figma frame (which just showed the 4
 * badges fixed in place). The track is the original artwork with the
 * badges masked out; each badge is its own cropped sprite so it can be
 * positioned and spun independently.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

const track = require('../../assets/images/step-2-track.png');

const ORBIT_DURATION_MS = 22000;
const RADIUS_FRACTION = 0.32;
const BADGE_SIZE_FRACTION = 0.34;

const badges = [
  { source: require('../../assets/images/badge-checkmark.png'), angle: 45 },
  { source: require('../../assets/images/badge-naira.png'), angle: 135 },
  { source: require('../../assets/images/badge-party-popper.png'), angle: 225 },
  { source: require('../../assets/images/badge-document.png'), angle: 315 },
];

type OrbitingBadgeProps = {
  source: number;
  angle: number;
  spin: Animated.Value;
  size: number;
  radius: number;
};

/**
 * Orbits `source` around the container's center at `radius`, starting at
 * `angle` degrees (clockwise from 12 o'clock) and advancing with `spin`
 * (0 -> 1 once per loop). A counter-rotation cancels the accumulated
 * rotation from its ancestors so the icon itself never tips over.
 */
function OrbitingBadge({ source, angle, spin, size, radius }: OrbitingBadgeProps) {
  const orbitRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterRotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: [`${-angle}deg`, `${-angle - 360}deg`],
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]}>
      <View style={{ transform: [{ rotate: `${angle}deg` }] }}>
        <Animated.View style={{ transform: [{ rotate: orbitRotate }] }}>
          <View style={{ transform: [{ translateY: -radius }] }}>
            <Animated.View style={{ width: size, height: size, transform: [{ rotate: counterRotate }] }}>
              <Image source={source} style={styles.badgeImage} contentFit="contain" />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

function Step2Illustration() {
  const spin = useRef(new Animated.Value(0)).current;
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ORBIT_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox({ width, height });
  };

  const size = Math.min(box.width, box.height);

  return (
    <View style={styles.illustration} onLayout={handleLayout}>
      <Image source={track} style={StyleSheet.absoluteFill} contentFit="contain" />
      {size > 0 &&
        badges.map((badge) => (
          <OrbitingBadge
            key={badge.angle}
            source={badge.source}
            angle={badge.angle}
            spin={spin}
            size={size * BADGE_SIZE_FRACTION}
            radius={size * RADIUS_FRACTION}
          />
        ))}
    </View>
  );
}

export default function OnboardingStepTwo() {
  return (
    <OnboardingScreen
      step={2}
      heading="File in Four Simple Steps"
      body="Follow four simple steps to complete your tax filing."
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
  illustration: {
    width: '100%',
    height: '100%',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeImage: {
    width: '100%',
    height: '100%',
  },
});
