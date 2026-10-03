/**
 * Onboarding step 3: a small identity card with the BVN and NIN masked. It is
 * drawn like a real ID card: an IDENTITY label with the Fileo wordmark, a
 * photo slot, the two numbers showing seven dots and the last four digits, a
 * dashed security seal on the photo's corner, and a machine-readable strip
 * that sinks into the white below. All numbers are made up. This is the last
 * step: both the swipe and the CTA button finish onboarding and land on
 * create-account.
 *
 * Motion, once each time the screen comes into view (it remounts on every
 * visit): the numbers start in full, the digits turn into dots one by one
 * from left to right leaving the last four, the seal pops on, and then the
 * card floats very gently. With reduce motion on, it shows the masked card,
 * still.
 */
import { ShieldCheck, UserRound } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { onboardingArt, useNativeDriver, useReduceMotion } from '../../components/onboarding/art';
import { IllustrationCanvas } from '../../components/onboarding/IllustrationCanvas';
import { floatTranslate, useLoopClock } from '../../components/onboarding/motion';
import { FileoWordmark } from '../../components/ui/FileoWordmark';
import { colors } from '../../constants/colors';

/** Made-up numbers: only the last four digits stay visible. */
const ROWS = [
  { label: 'BVN', digits: '22190314567' },
  { label: 'NIN', digits: '70629158910' },
];
const VISIBLE_DIGITS = 4;

/** Designed at this width (an ID card's proportions) and scaled to about 62% of the screen. */
const DESIGN_WIDTH = 260;
const CARD_WIDTH_FRACTION = 0.62;
/** Where the card's top sits in the square, so its machine-readable strip sinks into the white. */
const CARD_TOP = 0.38;

const DIGIT = { width: 10.5, size: 16, line: 20 };
const PHOTO = { width: 58, height: 70 };
const SEAL = 30;
/** Sized to fit the card's inner width at 9pt monospace, so nothing is cut or ellipsised. */
const MRZ_LINES = [`FILEO${'<'.repeat(30)}`, '<'.repeat(35)];
const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

type DigitProps = { char: string; masked: Animated.Value | null; u: number };

/** One fixed-width character cell; when `masked` is set, it cross-fades the digit into a dot. */
function DigitCell({ char, masked, u }: DigitProps) {
  const textStyle = [styles.digit, { fontSize: DIGIT.size * u, lineHeight: DIGIT.line * u }];
  if (!masked) {
    return (
      <View style={{ width: DIGIT.width * u }}>
        <Text allowFontScaling={false} style={textStyle}>
          {char}
        </Text>
      </View>
    );
  }
  const digitOpacity = masked.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const dotScale = masked.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <View style={{ width: DIGIT.width * u }}>
      <Animated.Text allowFontScaling={false} style={[textStyle, { opacity: digitOpacity }]}>
        {char}
      </Animated.Text>
      <Animated.Text
        allowFontScaling={false}
        style={[textStyle, styles.cellOverlay, { opacity: masked, transform: [{ scale: dotScale }] }]}
      >
        {'•'}
      </Animated.Text>
    </View>
  );
}

/** A dashed round seal with a shield, like the hologram on an ID card. */
function Seal({ size }: { size: number }) {
  const r = size / 2;
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={r} cy={r} r={r - 1} fill={colors.background} />
        <Circle
          cx={r}
          cy={r}
          r={r - 3}
          fill={colors.primaryLight}
          stroke={colors.primary}
          strokeWidth={onboardingArt.lineWidth}
          strokeDasharray="2.5 2.5"
        />
      </Svg>
      <View>
        <ShieldCheck size={Math.round(size * 0.47)} color={colors.primary} />
      </View>
    </View>
  );
}

function IdCard({ side, box }: { side: number; box: { width: number; height: number } }) {
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const maskCount = ROWS[0].digits.length - VISIBLE_DIGITS;
  const masks = useRef(ROWS.map(() => Array.from({ length: maskCount }, () => new Animated.Value(0)))).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [settled, setSettled] = useState(false);
  const floating = settled && reduceMotion === false;
  const clock = useLoopClock(onboardingArt.floatMs, floating);

  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    if (reduceMotion) {
      masks.flat().forEach((value) => value.setValue(1));
      pop.setValue(1);
      return;
    }
    const fade = (value: Animated.Value) =>
      Animated.timing(value, {
        toValue: 1,
        duration: onboardingArt.maskFadeMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver,
      });
    const animation = Animated.sequence([
      Animated.delay(onboardingArt.maskStartDelayMs),
      // the second row trails the first by half a step
      Animated.parallel(
        masks.map((row, r) =>
          Animated.sequence([
            Animated.delay((r * onboardingArt.maskStepMs) / 2),
            Animated.stagger(onboardingArt.maskStepMs, row.map(fade)),
          ])
        )
      ),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        setSettled(true);
      }
    });
    return () => animation.stop();
  }, [masks, pop, reduceMotion]);

  const cardWidth = Math.min(screenWidth * CARD_WIDTH_FRACTION, box.width);
  const u = cardWidth / DESIGN_WIDTH;
  const float = floatTranslate(clock, 0, floating);
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const label = [styles.label, { fontSize: 9 * u, lineHeight: 12 * u, letterSpacing: 1.2 * u }];

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          left: (side - cardWidth) / 2,
          top: side * CARD_TOP,
          padding: 14 * u,
          borderRadius: 12 * u,
          transform: [{ translateY: float }],
        },
      ]}
    >
      <View style={styles.header}>
        <Text allowFontScaling={false} style={label}>
          Identity
        </Text>
        <FileoWordmark width={46 * u} height={(46 * u * 35) / 141} color={colors.backgroundInverse} />
      </View>
      <View style={[styles.body, { marginTop: 10 * u, gap: 12 * u }]}>
        <View
          style={[
            styles.photo,
            styles.center,
            { width: PHOTO.width * u, height: PHOTO.height * u, borderRadius: 6 * u },
          ]}
        >
          <UserRound size={Math.round(34 * u)} color={colors.mutedStroke} />
          <Animated.View
            style={[
              styles.seal,
              { left: -SEAL * 0.3 * u, bottom: -SEAL * 0.3 * u, opacity: pop, transform: [{ scale: popScale }] },
            ]}
          >
            <Seal size={SEAL * u} />
          </Animated.View>
        </View>
        <View style={styles.numbers}>
          {ROWS.map((row, r) => (
            <View key={row.label}>
              <Text allowFontScaling={false} style={[label, { marginBottom: 2 * u }]}>
                {row.label}
              </Text>
              <View style={styles.row}>
                {row.digits.split('').map((char, i) => (
                  <DigitCell key={i} char={char} masked={i < maskCount ? masks[r][i] : null} u={u} />
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={{ marginTop: 12 * u }}>
        {MRZ_LINES.map((line) => (
          <Text
            key={line}
            allowFontScaling={false}
            style={[styles.mrz, { fontSize: 9 * u, lineHeight: 12 * u, letterSpacing: 1 * u }]}
          >
            {line}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

export default function OnboardingStepThree() {
  return (
    <OnboardingScreen
      step={3}
      heading="Your Data Is Safe"
      body="Your BVN and NIN are never stored in full, and your documents stay private to you."
      illustration={<IllustrationCanvas>{(side, box) => <IdCard side={side} box={box} />}</IllustrationCanvas>}
      prevRoute="/(onboarding)/step-2"
    />
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  body: {
    flexDirection: 'row',
  },
  photo: {
    backgroundColor: colors.navyTint,
  },
  seal: {
    position: 'absolute',
  },
  numbers: {
    flex: 1,
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
  },
  digit: {
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
  },
  cellOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  mrz: {
    fontFamily: mono,
    color: colors.mutedStroke,
  },
});
