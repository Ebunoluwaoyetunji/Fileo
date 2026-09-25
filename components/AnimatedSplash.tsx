/**
 * Animated splash — plays once per app launch, straight after the native
 * splash, then fades away to reveal whatever screen the app routed to
 * (onboarding, sign in or Home).
 *
 * Hand-off: the native splash (app.json → expo-splash-screen) is plain navy
 * #0B1628 — its image is transparent — and this overlay starts on the same
 * navy with the logo invisible, so there's no jump. The native splash is
 * only hidden once this overlay has been laid out on screen.
 *
 * Sequence (tweak the constants below):
 *   1. the FILEO wordmark fades in (0 → 1) and settles (0.92 → 1), ease-out
 *   2. a thin forest-green line draws in under it, left to right, starting
 *      a little before the logo finishes
 *   3. a short hold
 *   4. the whole splash fades out — but only once BOTH the sequence has
 *      played AND `ready` is true (the auth session has loaded). If loading
 *      takes longer it simply holds on the final frame; nothing loops.
 * With the system "reduce motion" setting on, it's a quick fade in and out:
 * no scaling, no drawing.
 *
 * Only opacity and transforms are animated, all with the native driver
 * (React Native's built-in Animated API — no extra native package), so it
 * runs on the UI thread at 60fps even while JS is busy loading.
 */
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { splashLayout } from '../constants/theme';
import { FileoWordmark } from './ui/FileoWordmark';

// ─── Timings (ms) and values — tweak here ───────────────────────────────────
/** Pause after the overlay appears, so the first frame is settled. */
const START_DELAY_MS = 100;
/** Logo fade + scale in. */
const LOGO_IN_MS = 500;
/** Logo starts at this opacity and scale. (Set both to 1 if the native
 * splash ever shows the logo itself, so the hand-off stays seamless.) */
const LOGO_FROM_OPACITY = 0;
const LOGO_FROM_SCALE = 0.92;
/** The green line starts drawing this long after the logo starts (a little
 * before the logo finishes) and takes LINE_DRAW_MS. */
const LINE_START_MS = 350;
const LINE_DRAW_MS = 400;
/** Hold on the finished frame before fading out. */
const HOLD_MS = 300;
/** Whole splash fades out. */
const FADE_OUT_MS = 250;
/** Reduce motion: simple fades only. */
const REDUCED_FADE_IN_MS = 200;
const REDUCED_HOLD_MS = 200;
const REDUCED_FADE_OUT_MS = 200;
// Total with defaults: 100 + 350 + 400 + 300 + 250 = 1,400 ms (plus any
// wait for the session to load).

// ─── Look ───────────────────────────────────────────────────────────────────
const LOGO_WIDTH = splashLayout.logoWidth;
const LOGO_HEIGHT = splashLayout.logoHeight;
const LINE_THICKNESS = 2;
const LINE_GAP = 14;
const LINE_COLOR = colors.primary; // forest green #0B6E4F

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);

type Props = {
  /** True once the app knows where to go (auth session loaded). */
  ready: boolean;
  /** Called after the fade-out, so the overlay can be removed. */
  onFinish: () => void;
};

// Ask about "reduce motion" as soon as this module loads, so the answer is
// usually in before the splash mounts and nothing waits for it.
let reduceMotionSetting: boolean | null = null;
const reduceMotionCheck = AccessibilityInfo.isReduceMotionEnabled()
  .catch(() => false)
  .then((enabled) => {
    reduceMotionSetting = enabled;
    return enabled;
  });

// The whole sequence is one timeline (ms) on the native thread; each part is
// a slice of it. Once started it needs nothing from JavaScript, so it stays
// smooth while the app is still loading behind it.
const LOGO_START = START_DELAY_MS;
const LOGO_END = LOGO_START + LOGO_IN_MS;
const LINE_START = LOGO_START + LINE_START_MS;
const LINE_END = LINE_START + LINE_DRAW_MS;
const SEQUENCE_MS = Math.max(LOGO_END, LINE_END) + HOLD_MS;
const REDUCED_SEQUENCE_MS = REDUCED_FADE_IN_MS + REDUCED_HOLD_MS;

export function AnimatedSplash({ ready, onFinish }: Props) {
  const timeline = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  // Always starts unknown (plain navy) and is filled in after mount, so a
  // pre-rendered web page and the live app render the same first frame.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const nativeHidden = useRef(false);

  useEffect(() => {
    if (reduceMotionSetting !== null) {
      setReduceMotion(reduceMotionSetting);
      return;
    }
    let active = true;
    reduceMotionCheck.then((enabled) => {
      if (active) {
        setReduceMotion(enabled);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // The native splash goes only once this overlay is on screen (same navy),
  // so there's never a flash of the app underneath.
  const handleLayout = () => {
    if (!nativeHidden.current) {
      nativeHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  };

  // Play the timeline once we know whether to reduce motion.
  useEffect(() => {
    if (reduceMotion === null) {
      return;
    }
    const animation = Animated.timing(timeline, {
      toValue: reduceMotion ? REDUCED_SEQUENCE_MS : SEQUENCE_MS,
      duration: reduceMotion ? REDUCED_SEQUENCE_MS : SEQUENCE_MS,
      easing: Easing.linear, // each slice below has its own easing
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setSequenceDone(true);
      }
    });
    return () => animation.stop();
  }, [reduceMotion, timeline]);

  // Fade out when both the sequence has played and the app is ready.
  useEffect(() => {
    if (!sequenceDone || !ready || fadingOut) {
      return;
    }
    setFadingOut(true);
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: reduceMotion ? REDUCED_FADE_OUT_MS : FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [sequenceDone, ready, fadingOut, reduceMotion, splashOpacity, onFinish]);

  const slice = (from: number, to: number, outputRange: number[], easing: (t: number) => number) =>
    timeline.interpolate({ inputRange: [from, to], outputRange, easing, extrapolate: 'clamp' });

  // Reduce motion: a plain fade, no scaling or drawing.
  const logoOpacity = reduceMotion
    ? slice(0, REDUCED_FADE_IN_MS, [0, 1], Easing.linear)
    : slice(LOGO_START, LOGO_END, [LOGO_FROM_OPACITY, 1], EASE_OUT);
  const logoScale = reduceMotion ? 1 : slice(LOGO_START, LOGO_END, [LOGO_FROM_SCALE, 1], EASE_OUT);
  const lineProgress = reduceMotion ? 1 : slice(LINE_START, LINE_END, [0, 1], EASE_IN_OUT);
  const lineOpacity = reduceMotion ? logoOpacity : 1;

  // The line grows from its left edge: scaleX works around the centre, so
  // shift it left by half the missing width as it grows.
  const lineTransform =
    typeof lineProgress === 'number'
      ? []
      : [
          { translateX: lineProgress.interpolate({ inputRange: [0, 1], outputRange: [-LOGO_WIDTH / 2, 0] }) },
          { scaleX: lineProgress.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) },
        ];

  return (
    <Animated.View
      style={[styles.container, { opacity: splashOpacity }]}
      pointerEvents={fadingOut ? 'none' : 'auto'}
      onLayout={handleLayout}
      accessible
      accessibilityLabel="Fileo"
    >
      <StatusBar style="light" />
      {/* Until we know about reduce motion the screen is plain navy — which
          looks the same, since the logo starts invisible. */}
      {reduceMotion !== null ? (
        <View style={styles.logoBox}>
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <FileoWordmark width={LOGO_WIDTH} height={LOGO_HEIGHT} />
          </Animated.View>
          <Animated.View style={[styles.line, { opacity: lineOpacity, transform: lineTransform }]} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.backgroundInverse, // navy #0B1628, as the native splash
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  // Sized to the logo alone, so the logo sits at the exact centre (where the
  // native splash centres its image); the line hangs below it.
  logoBox: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  line: {
    position: 'absolute',
    left: 0,
    top: LOGO_HEIGHT + LINE_GAP,
    width: LOGO_WIDTH,
    height: LINE_THICKNESS,
    borderRadius: LINE_THICKNESS / 2,
    backgroundColor: LINE_COLOR,
  },
});
