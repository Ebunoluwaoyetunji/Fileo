/**
 * A progress ring split into equal segments with small gaps: completed
 * segments are filled (green by default), the rest faint. Anything passed
 * as children sits in the centre (e.g. "3/5", or a tick).
 *
 * On first show, and whenever `completed` changes, the fill sweeps smoothly segment by segment
 * (skipped when the user has Reduce Motion on). Segment ends are rounded;
 * the gap between segments stays the same whatever the size or stroke.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/colors';

type Props = {
  /** Number of segments (one per step). */
  total: number;
  /** How many are filled, 0 to total. */
  completed: number;
  /** Shown in the middle of the ring. */
  children?: ReactNode;
  size?: number;
  strokeWidth?: number;
  /** Space between segments, in points (measured between the rounded ends). */
  gap?: number;
  fillColor?: string;
  trackColor?: string;
  /** Read out by screen readers, e.g. "3 of 5 steps done". */
  accessibilityLabel?: string;
};

const FILL_MS_PER_SEGMENT = 260;

/** An SVG arc from `start` to `end` (radians, 0 = 12 o'clock, clockwise). */
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const x1 = cx + r * Math.sin(start);
  const y1 = cy - r * Math.cos(start);
  const x2 = cx + r * Math.sin(end);
  const y2 = cy - r * Math.cos(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export function SegmentedRing({
  total,
  completed,
  children,
  size = 88,
  strokeWidth = 8,
  gap = 6,
  fillColor = colors.primary,
  trackColor = colors.border,
  accessibilityLabel,
}: Props) {
  const target = Math.max(0, Math.min(completed, total));
  // Starts empty, so the fill sweeps in when the ring first appears.
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setShown(value));
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) {
          return;
        }
        progress.stopAnimation((from) => {
          const distance = Math.abs(target - from);
          if (reduceMotion || distance === 0) {
            progress.setValue(target);
            return;
          }
          animation = Animated.timing(progress, {
            toValue: target,
            duration: Math.min(distance * FILL_MS_PER_SEGMENT, 900),
            easing: Easing.out(Easing.cubic),
            // Drives SVG paths, which the native driver can't animate.
            useNativeDriver: false,
          });
          animation.start();
        });
      });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [progress, target]);

  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const segment = (2 * Math.PI) / Math.max(total, 1);
  // The round caps reach strokeWidth/2 past each end, so trim that off too.
  const trim = Math.min((gap / 2 + strokeWidth / 2) / r, segment / 2 - 0.01);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: total, now: target }}
    >
      <Svg width={size} height={size}>
        {Array.from({ length: total }, (_, i) => {
          const start = i * segment + trim;
          const end = (i + 1) * segment - trim;
          return (
            <Path
              key={`t${i}`}
              d={arcPath(c, c, r, start, end)}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        {Array.from({ length: total }, (_, i) => {
          const fill = Math.max(0, Math.min(shown - i, 1));
          if (fill <= 0.001) {
            return null;
          }
          const start = i * segment + trim;
          const end = start + (segment - 2 * trim) * fill;
          return (
            <Path
              key={`f${i}`}
              d={arcPath(c, c, r, start, end)}
              stroke={fillColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
      </Svg>
      {children ? (
        <View style={styles.centre} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
