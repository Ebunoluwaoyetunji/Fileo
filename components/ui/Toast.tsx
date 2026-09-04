/**
 * Minimal, non-blocking toast banner. Slides/fades in from the top,
 * auto-dismisses after `duration`, and never intercepts touches — the
 * screen behind it stays fully interactive the whole time.
 *
 * Controlled by the caller via `visible`; call `onHide` to clear your own
 * state once the dismiss animation finishes (e.g. to then navigate away).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

type ToastProps = {
  visible: boolean;
  message: string;
  /** How long the toast stays fully visible before it fades out, in ms. */
  duration?: number;
  onHide?: () => void;
};

const DEFAULT_DURATION_MS = 2500;
const ANIMATION_MS = 220;
const HIDDEN_OFFSET = -80;

export function Toast({ visible, message, duration = DEFAULT_DURATION_MS, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(HIDDEN_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: ANIMATION_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: ANIMATION_MS, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: HIDDEN_OFFSET,
          duration: ANIMATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, { toValue: 0, duration: ANIMATION_MS, useNativeDriver: true }),
      ]).start(() => onHide?.());
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        { top: insets.top + spacing.sm, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 100,
    elevation: 10,
    backgroundColor: colors.backgroundInverse,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
  },
  text: {
    ...typography.bodyStrong,
    color: colors.textInverse,
    textAlign: 'center',
  },
});
