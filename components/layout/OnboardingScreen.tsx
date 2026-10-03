/**
 * Shared layout for the onboarding carousel (Figma nodes 88:663, 93:942,
 * 90:921): a navy hero (heading, body, illustration) over a white footer
 * (progress dots + CTA), reused by all three onboarding steps. Each
 * illustration sinks into white at its foot (IllustrationCanvas), and the
 * white runs on into the footer. The
 * hero colour, text colours and active dot live here, not per screen, so the
 * three screens always match.
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

type OnboardingScreenProps = {
  step: number;
  totalSteps?: number;
  heading: string;
  body: string;
  illustration: ReactNode;
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
    // Auto-advance between steps, but never off the carousel on its own —
    // the last step should wait for the user to tap "Create Account".
    if (!nextRoute) {
      return;
    }
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
          colors={[colors.backgroundInverse, colors.heroNavyEnd]}
          style={styles.hero}
          contentStyle={styles.heroContent}
        >
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.illustration}>{illustration}</View>
        </GradientBackground>

        <View style={styles.footer}>
          <ProgressDots total={totalSteps} current={step} activeColor={colors.primary} />
          <Button
            label="Create Account"
            variant="primary"
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
    color: colors.textInverse,
  },
  body: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.textInverse,
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
