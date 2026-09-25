/**
 * Animated splash — plays once per app launch, straight after the native
 * splash, then zooms through the O into whatever screen the app routed to
 * (onboarding, sign in or Home).
 *
 * Hand-off: the native splash (app.json → expo-splash-screen) is plain navy
 * #0B1628 — its image is transparent — and this overlay starts on the same
 * navy with nothing on it, so there's no jump. The native splash is only
 * hidden once this overlay has been laid out on screen.
 *
 * The bouncing ball:
 *   1. the five letters of FILEO fade in, dimmed
 *   2. a small green ball drops onto the F, then hops F → I → L → E → O in
 *      natural arcs (ease-out up, ease-in down)
 *   3. on each landing the ball squashes a little and stretches as it takes
 *      off again, and the letter dips and springs back, lighting up to full
 *      opacity
 *   4. from the O the ball makes one small hop into the O's centre and
 *      shrinks away inside it
 *   5. the whole word does a quick "heartbeat" (up to 1.08 and back)
 *   6. the zoom — but only once BOTH the sequence has played AND `ready` is
 *      true (the auth session has loaded); if loading takes longer it holds
 *      on the logo, nothing loops:
 *        - F, I, L and E fade out, drifting away from the O
 *        - the O (inner shape and all) grows, ease-in, heading for the
 *          middle of the solid white wedge in its lower right, until that
 *          white covers the whole screen
 *        - the now-white screen cross-fades into the next screen
 * With the system "reduce motion" setting on: no ball and no zoom, the
 * letters simply fade in together, hold, and the splash fades out.
 *
 * The letters are the wordmark's own SVG paths, one per letter (see
 * FileoWordmark), each drawn in the full wordmark viewBox — so the logo
 * frame before the zoom is exactly the wordmark.
 *
 * Sharpness: an SVG is drawn once at its laid-out size, so scaling it up
 * blurs it (notably on Android). The O is therefore also drawn at 4x and 16x
 * its size and scaled down to match; as the zoom passes each size, that copy
 * takes over, so the O's edges stay crisp while they're on screen. The last
 * frame of the zoom is one solid colour.
 *
 * Every movement is worked out once here, in JavaScript, as keyframes on a
 * single timeline, then played by the native driver (React Native's
 * built-in Animated API, no extra package): only opacity and transforms,
 * all on the UI thread, so it stays smooth while the app loads behind it.
 */
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../constants/colors';
import { splashLayout } from '../constants/theme';
import { buildWordmarkXml, FILEO_LETTER_PATHS, FILEO_WORDMARK_COLOR } from './ui/FileoWordmark';

// ─── Timings (ms) — tweak here ───────────────────────────────────────────────
/** Plain navy before anything moves (matches the native splash). */
const START_DELAY_MS = 100;
/** The dimmed letters fade in from the navy. */
const LETTERS_APPEAR_MS = 250;
/** The ball falls from above onto the F. */
const DROP_MS = 320;
/** Time on each letter: squash on landing, stretch on take-off. */
const CONTACT_MS = 60;
/** Each hop between letters. */
const HOP_MS = 220;
/** The last little hop from the top of the O into its centre. */
const FINAL_HOP_MS = 260;
/** A landed-on letter dips, then springs back. */
const LETTER_DIP_MS = 70;
const LETTER_RECOVER_MS = 200;
/** A landed-on letter goes from dimmed to full. */
const LETTER_LIGHT_MS = 160;
/** The word's "heartbeat" at the end (up and back). */
const HEARTBEAT_MS = 400;
/** Zoom: F, I, L and E fade out (and drift) as the O starts to grow. */
const LETTERS_OUT_MS = 150;
/** Zoom: the O grows until it fills the screen (ease-in). */
const ZOOM_MS = 650;
/** Zoom: the filled screen cross-fades into the next screen. */
const CROSSFADE_MS = 200;
/** Reduce motion: letters fade in together, hold, fade out. */
const REDUCED_FADE_IN_MS = 250;
const REDUCED_HOLD_MS = 300;
const REDUCED_FADE_OUT_MS = 200;
// Total with defaults: 100 + 320 + 5×60 + 4×220 + 260 + 400 = 2,260 ms of
// bouncing ball, then 650 ms zoom + 200 ms cross-fade = 3,110 ms (plus any
// wait for the session to load, spent holding on the logo).

// ─── Amounts and look — tweak here ───────────────────────────────────────────
/** Letters before the ball lands on them. */
const DIM_OPACITY = 0.25;
/** Ball diameter (pt): about twice the wordmark's stroke width. */
const BALL_SIZE = 8;
/** Forest green, lightened (#0B6E4F → #129A6F) so a small ball reads clearly
 * on navy: about 5:1 contrast instead of under 3:1. */
const BALL_COLOR = '#129A6F';
/** How far above the letters the ball starts its drop (pt). */
const DROP_HEIGHT = 64;
/** Height of each hop's arc above the letters (pt). */
const HOP_HEIGHT = 14;
/** Height of the last hop, before it drops into the O (pt). */
const FINAL_HOP_HEIGHT = 8;
/** On landing the ball gets this much wider and shorter (0.18 = 18%). */
const SQUASH = 0.18;
/** On take-off it gets this much taller and narrower. */
const STRETCH = 0.12;
/** How far a landed-on letter dips (pt), and its spring-back overshoot. */
const LETTER_DIP = 3.5;
const LETTER_SPRING = 1.2; // Easing.back amount: ~0.3pt overshoot
/** Heartbeat peak scale. */
const HEARTBEAT_SCALE = 1.08;
/** How far F, I, L and E drift left, away from the O, as they fade (pt). */
const LETTERS_DRIFT = 12;
/** Where the zoom heads, in the wordmark's viewBox: the middle of the solid
 * white wedge in the O's lower right — the biggest solid area in the letter
 * (a circle of radius ZOOM_TARGET_RADIUS fits in it) — so the zoom ends on
 * plain letter colour. The O's exact centre (122.7, 17.5) is right at the
 * tip of the navy tongue, which would end on a ragged edge. (To end on navy
 * instead — through the O's counter — use { x: 120.5, y: 9.15 }, radius 7.7.) */
const ZOOM_TARGET = { x: 131.8, y: 25.5 };
const ZOOM_TARGET_RADIUS = 5.3;
/** Final scale: the O grows until that circle covers the whole screen,
 * corner to corner, times this margin — about 92x on a 390×844 phone (worked
 * out from the screen size, so bigger screens are covered too). */
const ZOOM_FINAL_SCALE_MARGIN = 1.05;
/** Extra copies of the O drawn at these sizes (× the wordmark's), each
 * taking over halfway (geometrically) from the previous one, so the O is
 * never shown enlarged more than 2x until it's 32x its size. */
const ZOOM_DETAIL_SCALES = [4, 16];

// ─── Geometry (wordmark viewBox units: 141 × 35) ─────────────────────────────
const LOGO_WIDTH = splashLayout.logoWidth;
const LOGO_HEIGHT = splashLayout.logoHeight;
const UNIT = LOGO_WIDTH / 141; // viewBox units → points
const LETTERS = ['F', 'I', 'L', 'E', 'O'] as const;
/** Where the ball lands on each letter: the middle of its top edge (the L's
 * stem, since the L has no top bar). */
const LANDING = [
  { x: 11.5, top: 0.6 }, // F
  { x: 34.7, top: 0.6 }, // I
  { x: 52.1, top: 0.6 }, // L (stem)
  { x: 86.0, top: 0.6 }, // E
  { x: 122.7, top: 0 }, // O
].map((p) => ({ x: p.x * UNIT, y: p.top * UNIT - BALL_SIZE / 2 }));
/** The O's centre, where the ball ends up. */
const O_CENTRE = { x: 122.7 * UNIT, y: 17.5 * UNIT };
/** The SVG is drawn at UNIT scale ("meet"), centred vertically. */
const OFFSET_Y = (LOGO_HEIGHT - 35 * UNIT) / 2;
/** The O's bounding box (viewBox units). */
const O_BOX = { x: 104.693, y: 0, width: 36.072, height: 34.992 };

// ─── The timeline ────────────────────────────────────────────────────────────
const DROP_START = START_DELAY_MS;
const impactAt = (k: number) => DROP_START + DROP_MS + k * (CONTACT_MS + HOP_MS);
const FINAL_HOP_START = impactAt(4) + CONTACT_MS;
const BALL_GONE = FINAL_HOP_START + FINAL_HOP_MS;
const HEARTBEAT_START = BALL_GONE;
const SEQUENCE_MS = HEARTBEAT_START + HEARTBEAT_MS;
const REDUCED_SEQUENCE_MS = REDUCED_FADE_IN_MS + REDUCED_HOLD_MS;

const easeIn = Easing.in(Easing.quad);
const easeOut = Easing.out(Easing.quad);
const easeInOut = Easing.inOut(Easing.quad);
const springBack = Easing.out(Easing.back(LETTER_SPRING));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const progress = (t: number, from: number, duration: number) => clamp01((t - from) / duration);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** How far letter k is dipped at time t (0 before its impact). */
function letterDip(k: number, t: number) {
  const impact = impactAt(k);
  if (t < impact) return 0;
  if (t < impact + LETTER_DIP_MS) return LETTER_DIP * easeOut(progress(t, impact, LETTER_DIP_MS));
  return LETTER_DIP * (1 - springBack(progress(t, impact + LETTER_DIP_MS, LETTER_RECOVER_MS)));
}

function letterOpacity(k: number, t: number) {
  const appear = DIM_OPACITY * easeOut(progress(t, START_DELAY_MS, LETTERS_APPEAR_MS));
  const light = easeOut(progress(t, impactAt(k), LETTER_LIGHT_MS));
  return lerp(appear, 1, light);
}

function wordScale(t: number) {
  const p = progress(t, HEARTBEAT_START, HEARTBEAT_MS);
  if (p <= 0 || p >= 1) return 1;
  const up = 0.4; // share of the heartbeat spent growing
  return p < up
    ? lerp(1, HEARTBEAT_SCALE, easeOut(p / up))
    : lerp(HEARTBEAT_SCALE, 1, easeInOut((p - up) / (1 - up)));
}

type BallState = { x: number; y: number; sx: number; sy: number; opacity: number };

/** The ball's centre, squash/stretch and opacity at time t. */
function ball(t: number): BallState {
  const land = LANDING;
  // Drop onto the F, stretching slightly as it falls.
  if (t < impactAt(0)) {
    const p = progress(t, DROP_START, DROP_MS);
    return {
      x: land[0].x,
      y: land[0].y - DROP_HEIGHT * (1 - easeIn(p)),
      sx: 1,
      sy: 1 + STRETCH * 0.5 * easeIn(p),
      opacity: easeOut(progress(t, DROP_START, 120)),
    };
  }
  for (let k = 0; k < 5; k++) {
    const impact = impactAt(k);
    // On letter k: squash, then stretch as it leaves; rides the letter's dip.
    if (t < impact + CONTACT_MS) {
      // Arrives slightly stretched, squashes, then stretches to take off.
      const p = progress(t, impact, CONTACT_MS);
      const sy =
        p < 0.45
          ? lerp(1 + STRETCH * 0.5, 1 - SQUASH, Math.sin((p / 0.45) * (Math.PI / 2)))
          : lerp(1 - SQUASH, 1 + STRETCH, easeInOut((p - 0.45) / 0.55));
      return { x: land[k].x, y: land[k].y + letterDip(k, t), sx: 1 / Math.pow(sy, 0.8), sy, opacity: 1 };
    }
    // Hop k → k+1: a parabola (ease-out up, ease-in down), straight across.
    if (k < 4 && t < impactAt(k + 1)) {
      const p = progress(t, impact + CONTACT_MS, HOP_MS);
      const arc = 1 - Math.pow(2 * p - 1, 2);
      const takeOffY = land[k].y + letterDip(k, impact + CONTACT_MS);
      const sy = 1 + STRETCH * (p < 0.4 ? 1 - easeOut(p / 0.4) : p > 0.7 ? 0.5 * easeIn((p - 0.7) / 0.3) : 0);
      return {
        x: lerp(land[k].x, land[k + 1].x, p),
        y: lerp(takeOffY, land[k + 1].y, p) - HOP_HEIGHT * arc,
        sx: 1 / Math.pow(sy, 0.8),
        sy,
        opacity: 1,
      };
    }
  }
  // Last hop: up a little, then down into the O's centre, shrinking away.
  const p = progress(t, FINAL_HOP_START, FINAL_HOP_MS);
  const apex = 0.35;
  const takeOffY = land[4].y + letterDip(4, FINAL_HOP_START);
  const y =
    p < apex
      ? lerp(takeOffY, land[4].y - FINAL_HOP_HEIGHT, easeOut(p / apex))
      : lerp(land[4].y - FINAL_HOP_HEIGHT, O_CENTRE.y, easeIn((p - apex) / (1 - apex)));
  const shrink = 1 - 0.9 * easeIn(progress(p, 0.4, 0.6));
  return {
    x: lerp(land[4].x, O_CENTRE.x, p),
    y,
    sx: shrink,
    sy: shrink,
    opacity: 1 - easeIn(progress(p, 0.55, 0.45)),
  };
}

// ─── Keyframes ───────────────────────────────────────────────────────────────
/** Samples f along the timeline (every ~8ms, i.e. 120 per second) and drops
 * points that add nothing, giving an interpolation the native driver can
 * play on its own. */
function keyframes(f: (t: number) => number, end: number): { inputRange: number[]; outputRange: number[] } {
  const step = 1000 / 120;
  const ts: number[] = [];
  for (let t = 0; t < end; t += step) ts.push(t);
  ts.push(end);
  const vs = ts.map(f);
  const inputRange: number[] = [ts[0]];
  const outputRange: number[] = [vs[0]];
  for (let i = 1; i < ts.length - 1; i++) {
    const [a, b, c] = [vs[i - 1], vs[i], vs[i + 1]];
    // keep a point unless it's on a straight line between its neighbours
    const expected = a + ((c - a) * (ts[i] - ts[i - 1])) / (ts[i + 1] - ts[i - 1]);
    if (Math.abs(b - expected) > 1e-4) {
      inputRange.push(ts[i]);
      outputRange.push(b);
    }
  }
  inputRange.push(ts[ts.length - 1]);
  outputRange.push(vs[vs.length - 1]);
  return { inputRange, outputRange };
}

// Worked out once, when this module loads.
const TRACKS = {
  letterOpacity: LETTERS.map((_, k) => keyframes((t) => letterOpacity(k, t), SEQUENCE_MS)),
  letterDip: LETTERS.map((_, k) => keyframes((t) => letterDip(k, t), SEQUENCE_MS)),
  wordScale: keyframes(wordScale, SEQUENCE_MS),
  ballX: keyframes((t) => ball(t).x - BALL_SIZE / 2, SEQUENCE_MS),
  // Squash/stretch keeps the ball's bottom on the letter: scale works around
  // the centre, so shift down by the height it loses.
  ballY: keyframes((t) => {
    const b = ball(t);
    return b.y - BALL_SIZE / 2 + ((1 - b.sy) * BALL_SIZE) / 2;
  }, SEQUENCE_MS),
  ballScaleX: keyframes((t) => ball(t).sx, SEQUENCE_MS),
  ballScaleY: keyframes((t) => ball(t).sy, SEQUENCE_MS),
  ballOpacity: keyframes((t) => (t < DROP_START ? 0 : ball(t).opacity), SEQUENCE_MS),
};

const LETTER_XML = LETTERS.map((letter) => buildWordmarkXml(FILEO_WORDMARK_COLOR, [FILEO_LETTER_PATHS[letter]]));

// ─── The zoom ────────────────────────────────────────────────────────────────
/** The O on its own, cropped to its bounding box, for the large copies. */
const O_ONLY_XML = `<svg width="${O_BOX.width}" height="${O_BOX.height}" viewBox="${O_BOX.x} ${O_BOX.y} ${O_BOX.width} ${O_BOX.height}" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${FILEO_LETTER_PATHS.O}" fill="${FILEO_WORDMARK_COLOR}"/></svg>`;

/** A copy of the O drawn `detail` times larger, then scaled down by the same
 * factor around its centre so it sits exactly on the wordmark's O. */
function detailBox(detail: number) {
  const width = O_BOX.width * UNIT * detail;
  const height = O_BOX.height * UNIT * detail;
  const centreX = (O_BOX.x + O_BOX.width / 2) * UNIT;
  const centreY = (O_BOX.y + O_BOX.height / 2) * UNIT + OFFSET_Y;
  return {
    position: 'absolute' as const,
    left: centreX - width / 2,
    top: centreY - height / 2,
    width,
    height,
    transform: [{ scale: 1 / detail }],
  };
}
const DETAIL_BOXES = ZOOM_DETAIL_SCALES.map(detailBox);

type Track = { inputRange: number[]; outputRange: number[] };
/** 0 before `at`, 1 after (or the other way round). */
const step = (at: number, from: number, to: number): Track => ({
  inputRange: [0, Math.max(0, at - 1), Math.max(0, at - 1) + 0.01, ZOOM_MS + 1],
  outputRange: [from, from, to, to],
});

/** The zoom's keyframes for a screen of this size. Everything moves around
 * the logo's centre, which is the screen's centre. */
function zoomTracks(screenWidth: number, screenHeight: number) {
  const halfDiagonal = Math.hypot(screenWidth, screenHeight) / 2;
  const finalScale = Math.max(2, (halfDiagonal / (ZOOM_TARGET_RADIUS * UNIT)) * ZOOM_FINAL_SCALE_MARGIN);
  // The target, relative to the screen's centre, before the zoom.
  const target = {
    x: ZOOM_TARGET.x * UNIT - LOGO_WIDTH / 2,
    y: ZOOM_TARGET.y * UNIT + OFFSET_Y - LOGO_HEIGHT / 2,
  };
  // Ease-in on a log scale: every doubling of size takes less time than the
  // last, so it starts slow and plunges.
  const scaleAt = (t: number) => Math.pow(finalScale, easeIn(progress(t, 0, ZOOM_MS)));
  const timeAtScale = (s: number) => ZOOM_MS * Math.sqrt(Math.log(s) / Math.log(finalScale)); // inverse of easeIn (quad)
  // The target glides to the screen's centre as the O grows around it.
  const glide = (t: number) => 1 - easeInOut(progress(t, 0, ZOOM_MS));
  const lettersOut = (t: number) => easeOut(progress(t, 0, LETTERS_OUT_MS));
  // Each larger copy of the O takes over at the geometric midpoint between
  // its size and the previous one's (4x at 2x, 16x at 8x).
  const sizes = [1, ...ZOOM_DETAIL_SCALES];
  const handOver = sizes.slice(1).map((size, i) => timeAtScale(Math.sqrt(size * sizes[i])));
  return {
    scale: keyframes(scaleAt, ZOOM_MS),
    translateX: keyframes((t) => target.x * glide(t) - scaleAt(t) * target.x, ZOOM_MS),
    translateY: keyframes((t) => target.y * glide(t) - scaleAt(t) * target.y, ZOOM_MS),
    lettersOpacity: keyframes((t) => 1 - lettersOut(t), ZOOM_MS),
    lettersDrift: keyframes((t) => -LETTERS_DRIFT * lettersOut(t), ZOOM_MS),
    // The wordmark's own O, then each larger copy in turn.
    oOpacity: [
      step(handOver[0], 1, 0),
      ...handOver.map((at, i) => {
        const off = handOver[i + 1];
        const on = step(at, 0, 1);
        if (off === undefined) return on;
        return {
          inputRange: [...on.inputRange.slice(0, 3), off, off + 0.01, ZOOM_MS + 1],
          outputRange: [0, 0, 1, 1, 0, 0],
        };
      }),
    ],
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
type Props = {
  /** True once the app knows where to go (auth session loaded). */
  ready: boolean;
  /** Called once the next screen is showing, so the overlay can be removed. */
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

export function AnimatedSplash({ ready, onFinish }: Props) {
  const timeline = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Always starts unknown (plain navy) and is filled in after mount, so a
  // pre-rendered web page and the live app render the same first frame.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [sequenceDone, setSequenceDone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // The screen is covered in the (light) letter colour: dark status bar.
  const [covered, setCovered] = useState(false);
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
    const length = reduceMotion ? REDUCED_SEQUENCE_MS : SEQUENCE_MS;
    const animation = Animated.timing(timeline, {
      toValue: length,
      duration: length,
      easing: Easing.linear, // the keyframes carry all the easing
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setSequenceDone(true);
      }
    });
    return () => animation.stop();
  }, [reduceMotion, timeline]);

  // Leave once both the sequence has played and the app is ready: zoom
  // through the O, then cross-fade (reduce motion: just fade out).
  useEffect(() => {
    if (!sequenceDone || !ready || leaving) {
      return;
    }
    setLeaving(true);
    const fadeOut = (duration: number) =>
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => onFinish());
    if (reduceMotion) {
      fadeOut(REDUCED_FADE_OUT_MS);
      return;
    }
    Animated.timing(zoom, {
      toValue: ZOOM_MS,
      duration: ZOOM_MS,
      easing: Easing.linear, // the keyframes carry all the easing
      useNativeDriver: true,
    }).start(() => {
      setCovered(true);
      fadeOut(CROSSFADE_MS);
    });
  }, [sequenceDone, ready, leaving, reduceMotion, zoom, splashOpacity, onFinish]);

  const zoomKeyframes = useMemo(() => zoomTracks(screenWidth, screenHeight), [screenWidth, screenHeight]);

  const animated = useMemo(() => {
    const track = (k: Track) => timeline.interpolate({ ...k, extrapolate: 'clamp' });
    const zoomTrack = (k: Track) => zoom.interpolate({ ...k, extrapolate: 'clamp' });
    if (reduceMotion) {
      const fadeIn = timeline.interpolate({
        inputRange: [0, REDUCED_FADE_IN_MS],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
      return { letterOpacity: LETTERS.map(() => fadeIn), letterDip: null, letterDrift: null, wordScale: null, zoom: null, ball: null };
    }
    const lettersOut = zoomTrack(zoomKeyframes.lettersOpacity);
    const [wordmarkO, ...detailO] = zoomKeyframes.oOpacity.map(zoomTrack);
    return {
      // F, I, L, E fade out with the zoom; the wordmark's O hands over to its
      // larger copies.
      letterOpacity: TRACKS.letterOpacity.map((k, i) =>
        Animated.multiply(track(k), LETTERS[i] === 'O' ? wordmarkO : lettersOut)
      ),
      letterDip: TRACKS.letterDip.map(track),
      letterDrift: zoomTrack(zoomKeyframes.lettersDrift),
      wordScale: track(TRACKS.wordScale),
      zoom: {
        transform: [
          { translateX: zoomTrack(zoomKeyframes.translateX) },
          { translateY: zoomTrack(zoomKeyframes.translateY) },
          { scale: zoomTrack(zoomKeyframes.scale) },
        ],
        detailOpacity: detailO,
      },
      ball: {
        opacity: track(TRACKS.ballOpacity),
        transform: [
          { translateX: track(TRACKS.ballX) },
          { translateY: track(TRACKS.ballY) },
          { scaleX: track(TRACKS.ballScaleX) },
          { scaleY: track(TRACKS.ballScaleY) },
        ],
      },
    };
  }, [reduceMotion, timeline, zoom, zoomKeyframes]);

  return (
    <Animated.View
      style={[styles.container, { opacity: splashOpacity }]}
      pointerEvents={leaving ? 'none' : 'auto'}
      onLayout={handleLayout}
      accessible
      accessibilityLabel="Fileo"
    >
      <StatusBar style={covered ? 'dark' : 'light'} />
      {/* Until we know about reduce motion the screen is plain navy — which
          looks the same, since the letters start invisible. */}
      {reduceMotion !== null ? (
        <View style={styles.logoBox}>
          <Animated.View
            style={[styles.fill, animated.wordScale ? { transform: [{ scale: animated.wordScale }] } : null]}
          >
            {LETTERS.map((letter, k) => {
              const view = (
                <Animated.View
                  key={letter}
                  style={[
                    styles.fill,
                    {
                      opacity: animated.letterOpacity[k],
                      transform: [
                        ...(animated.letterDrift && letter !== 'O' ? [{ translateX: animated.letterDrift }] : []),
                        ...(animated.letterDip ? [{ translateY: animated.letterDip[k] }] : []),
                      ],
                    },
                  ]}
                >
                  <SvgXml xml={LETTER_XML[k]} width={LOGO_WIDTH} height={LOGO_HEIGHT} />
                </Animated.View>
              );
              if (letter !== 'O' || !animated.zoom) {
                return view;
              }
              // The O and its larger copies, zooming together.
              const { transform, detailOpacity } = animated.zoom;
              return (
                <Animated.View key={letter} style={[styles.fill, { transform }]}>
                  {view}
                  {DETAIL_BOXES.map((box, i) => (
                    <Animated.View key={i} style={[box, { opacity: detailOpacity[i] }]}>
                      <SvgXml xml={O_ONLY_XML} width={box.width} height={box.height} />
                    </Animated.View>
                  ))}
                </Animated.View>
              );
            })}
          </Animated.View>
          {animated.ball ? <Animated.View style={[styles.ball, animated.ball]} /> : null}
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
  // Sized to the logo, so it sits at the exact centre (where the native
  // splash centres its image).
  logoBox: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  ball: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: BALL_COLOR,
  },
});
