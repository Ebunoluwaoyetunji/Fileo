/**
 * Shared layout for the onboarding carousel (Figma nodes 88:663, 93:942,
 * 90:921): a colored hero panel (heading, body, illustration) over a white
 * footer (progress dots + CTA), reused by all three onboarding steps so the
 * structure lives in one place instead of being copy-pasted per screen.
 *
 * Navigation: auto-advances after a delay, is swipeable left/right, and the
 * CTA button always jumps straight to account creation (matching the
 * Figma frames, where every step shows only a single "Create Account"
 * button — there is no separate Next/Skip control in the design).
 */
import { Href, router } from 'expo-router';
import React, { ReactNode, useEffect, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../state/authContext';
import { colors } from '../../constants/colors';
import { layout, onboardingLayout, spacing, typography } from '../../constants/theme';
import { Screen } from './Screen';
import { Button } from '../ui/Button';
import { GradientBackground } from '../ui/GradientBackground';
import { ProgressDots } from '../ui/ProgressDots';

type HeroBackground = { colors: [string] | [string, string] };

type OnboardingScreenProps = {
  step: number;
  totalSteps?: number;
  heading: string;
  body: string;
  illustration: ReactNode;
  background: HeroBackground;
  headingColor: string;
  bodyColor: string;
  activeDotColor: string;
  /** Route for the next step; omit on the last step to finish onboarding. */
  nextRoute?: Href;
  /** Route for the previous step; omit on the first step. */
  prevRoute?: Href;
};

export function OnboardingScreen({
  step,
  totalSteps = 3,
  heading,
  body,
  illustration,
  background,
  headingColor,
  bodyColor,
  activeDotColor,
  nextRoute,
  prevRoute,
}: OnboardingScreenProps) {
  const { completeOnboarding } = useAuth();

  const finishOnboarding = () => {
    completeOnboarding();
    router.replace('/(auth)/create-account');
  };

  const advance = () => {
    if (nextRoute) {
      router.replace(nextRoute);
    } else {
      finishOnboarding();
    }
  };

  const goBack = () => {
    if (prevRoute) {
      router.replace(prevRoute);
    }
  };

  useEffect(() => {
    const timer = setTimeout(advance, onboardingLayout.autoAdvanceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= -onboardingLayout.swipeThreshold) {
          advance();
        } else if (gesture.dx >= onboardingLayout.swipeThreshold) {
          goBack();
        }
      },
    })
  ).current;

  return (
    <View style={styles.gestureRoot} {...panResponder.panHandlers}>
      <Screen edges={['top', 'bottom']} style={styles.screen}>
        <GradientBackground
          colors={background.colors}
          style={styles.hero}
          contentStyle={styles.heroContent}
        >
          <Text style={[styles.heading, { color: headingColor }]}>{heading}</Text>
          <Text style={[styles.body, { color: bodyColor }]}>{body}</Text>
          <View style={styles.illustration}>{illustration}</View>
        </GradientBackground>

        <View style={styles.footer}>
          <ProgressDots total={totalSteps} current={step} activeColor={activeDotColor} />
          <Button
            label="Create Account"
            variant="dark"
            onPress={finishOnboarding}
            style={styles.cta}
          />
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  screen: {
    paddingHorizontal: 0,
  },
  hero: {
    flex: 1,
  },
  heroContent: {
    flex: 1,
    paddingTop: spacing.xl,
    paddingHorizontal: layout.screenPadding,
  },
  heading: {
    ...typography.display,
  },
  body: {
    ...typography.body,
    marginTop: spacing.md,
  },
  illustration: {
    flex: 1,
    marginTop: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  cta: {
    width: '100%',
  },
});
