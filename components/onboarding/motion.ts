/**
 * Motion helpers for the onboarding illustrations. Everything is driven by a
 * looping clock (0 → 1, linear) and mapped through interpolations, so it runs
 * on the native driver as transforms only, and several elements can share one
 * clock while sitting at different phases. With reduce motion on, the clock
 * never starts and everything holds its rest position.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { onboardingArt, useNativeDriver } from './art';

/** A value that runs 0 → 1 every `durationMs`, forever, while `running`. */
export function useLoopClock(durationMs: number, running: boolean) {
  const clock = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) {
      clock.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(clock, { toValue: 1, duration: durationMs, easing: Easing.linear, useNativeDriver })
    );
    loop.start();
    return () => loop.stop();
  }, [clock, durationMs, running]);
  return clock;
}

const FLOAT_SAMPLES = 24;

/**
 * A gentle float: translateY follows a sine wave of `onboardingArt.floatDistance`
 * over one turn of `clock`, shifted by `phase` (0 to 1) so neighbours move out
 * of step. When not running it rests at 0.
 */
export function floatTranslate(clock: Animated.Value, phase: number, running: boolean) {
  if (!running) {
    return 0;
  }
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= FLOAT_SAMPLES; i++) {
    const t = i / FLOAT_SAMPLES;
    inputRange.push(t);
    outputRange.push(-onboardingArt.floatDistance * Math.sin(2 * Math.PI * (t + phase)));
  }
  return clock.interpolate({ inputRange, outputRange });
}
