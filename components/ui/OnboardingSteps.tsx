/**
 * A short vertical list of steps for navy surfaces (onboarding): each step is
 * a Lucide icon in a small circle (green icon, soft white fill, hairline
 * border), a title and a muted second line, with thin connector lines
 * between the circles. Same idea as Timeline (Return Review), drawn for navy.
 *
 * Motion, on mount: the rows fade and slide up one after another, each
 * connector draws downward as the next row arrives, and the last icon gets a
 * brief soft highlight when it lands. Opacity and transforms only, on the
 * native driver. With reduce motion on, everything simply fades in together.
 * The onboarding screens remount on every visit, so it replays each time.
 *
 *   <OnboardingSteps steps={[{ key: 'income', icon: Wallet, title: '…', detail: '…' }]} />
 */
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export type OnboardingStep = {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
};

type Props = {
  steps: OnboardingStep[];
};

/** Circle size and the connector's width. */
const CIRCLE = 44;
const LINE_WIDTH = 1.5;
/** Gap between a circle and the connector above or below it. */
const LINE_GAP = 4;
/** Entrance timing (ms). */
const START_DELAY = 150;
const STAGGER = 120;
const ROW_IN = 380;
const LINE_IN = 220;
const RISE = 14;

export function OnboardingSteps({ steps }: Props) {
  const rows = useRef(steps.map(() => new Animated.Value(0))).current;
  const lines = useRef(steps.map(() => new Animated.Value(0))).current;
  const highlight = useRef(new Animated.Value(0)).current;
  // Each row's top and height, so the connectors can span the gaps between circles.
  const [layouts, setLayouts] = useState<{ y: number; height: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) {
          return;
        }
        if (reduceMotion) {
          lines.forEach((line) => line.setValue(1));
          animation = Animated.parallel(
            rows.map((row) => Animated.timing(row, { toValue: 1, duration: 300, useNativeDriver: true }))
          );
        } else {
          const ease = Easing.out(Easing.cubic);
          const stagger = rows.map((row, i) =>
            Animated.sequence([
              Animated.delay(START_DELAY + i * STAGGER),
              Animated.parallel([
                Animated.timing(row, { toValue: 1, duration: ROW_IN, easing: ease, useNativeDriver: true }),
                // the connector above this row draws down as it arrives
                i > 0
                  ? Animated.timing(lines[i - 1], { toValue: 1, duration: LINE_IN, easing: ease, useNativeDriver: true })
                  : Animated.delay(0),
              ]),
            ])
          );
          const land = START_DELAY + (rows.length - 1) * STAGGER + ROW_IN - 80;
          animation = Animated.parallel([
            ...stagger,
            Animated.sequence([
              Animated.delay(land),
              Animated.timing(highlight, { toValue: 1, duration: 220, easing: ease, useNativeDriver: true }),
              Animated.timing(highlight, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            ]),
          ]);
        }
        animation.start();
      });
    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [rows, lines, highlight]);

  const onRowLayout = (index: number) => (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setLayouts((prev) => {
      const next = [...prev];
      next[index] = { y, height };
      return next;
    });
  };

  return (
    <View style={styles.list} accessibilityRole="list">
      {steps.slice(0, -1).map((step, i) => {
        const a = layouts[i];
        const b = layouts[i + 1];
        if (!a || !b) {
          return null;
        }
        // circles sit centred in their rows, so this holds when large text makes a row taller
        const top = a.y + (a.height + CIRCLE) / 2 + LINE_GAP;
        const height = b.y + (b.height - CIRCLE) / 2 - LINE_GAP - top;
        return (
          <Animated.View
            key={`line-${step.key}`}
            style={[
              styles.line,
              { top, height: Math.max(0, height), opacity: lines[i], transform: [{ scaleY: lines[i] }] },
            ]}
          />
        );
      })}
      {steps.map((step, i) => {
        const Icon = step.icon;
        const last = i === steps.length - 1;
        const row = rows[i];
        return (
          <Animated.View
            key={step.key}
            onLayout={onRowLayout(i)}
            style={[
              styles.row,
              !last && styles.rowSpaced,
              { opacity: row, transform: [{ translateY: row.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }] },
            ]}
            accessibilityRole="text"
            accessibilityLabel={`${step.title}. ${step.detail}`}
          >
            <View style={styles.circle}>
              {last ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.highlight,
                    {
                      opacity: highlight,
                      transform: [{ scale: highlight.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
                    },
                  ]}
                />
              ) : null}
              <Icon size={20} color={colors.primaryOnDark} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.detail}>{step.detail}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowSpaced: {
    marginBottom: spacing.xl,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.surfaceOnDark,
    borderWidth: 1,
    borderColor: colors.hairlineOnDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.faintOnDark,
  },
  line: {
    position: 'absolute',
    left: CIRCLE / 2 - LINE_WIDTH / 2,
    width: LINE_WIDTH,
    borderRadius: LINE_WIDTH,
    backgroundColor: colors.faintOnDark,
    transformOrigin: 'top',
  },
  text: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '500',
    color: colors.textInverse,
  },
  detail: {
    ...typography.caption,
    color: colors.textOnDarkMuted,
    marginTop: 2,
  },
});
