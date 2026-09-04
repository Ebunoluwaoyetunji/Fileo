/**
 * Shared layout for all the auth screens (Create Account, Sign In, Forgot
 * Password and its success/error states, OTP Verification): centered
 * wordmark, an optional icon, a heading (an accent-colored lead
 * word/phrase, optionally followed by a dark serif remainder — pass an
 * empty `headingRest` for an all-accent heading, or `headingAccentColor`
 * for a plain dark one), a body subtitle, the form fields, a full-width
 * dark CTA, and a bottom link row. The bottom link is either real
 * navigation (`bottomLinkHref`) or a mock local action (`bottomLinkOnPress`,
 * e.g. "Resend code") — pass exactly one.
 */
import { Href, Link } from 'expo-router';
import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { Button } from '../ui/Button';
import { FileoWordmark } from '../ui/FileoWordmark';
import { Screen } from './Screen';

type AuthScreenProps = {
  /** Optional icon rendered above the heading (e.g. an alert glyph). */
  icon?: ReactNode;
  /** Accent-colored lead word(s)/phrase of the heading, e.g. "Create". */
  headingAccent: string;
  /** Rest of the heading in the default dark color, e.g. " your Fileo account". */
  headingRest?: string;
  /** Color for `headingAccent` — defaults to the brand accent; pass a dark
   * text color for frames whose heading isn't accent-colored at all. */
  headingAccentColor?: string;
  /** Omit for frames with no subtitle (e.g. Identity Verification). */
  subtitle?: string;
  /** Defaults to the muted secondary color; some frames use the dark primary text color instead. */
  subtitleColor?: string;
  children: ReactNode;
  ctaLabel: string;
  onSubmitCta: () => void;
  ctaLoading?: boolean;
  /** Leading text before the bottom link, e.g. "Already have an account?". Omit for a standalone link/action. */
  bottomText?: string;
  /** Omit both this and the two props below for frames with no bottom link (e.g. Identity Verification). */
  bottomLinkLabel?: string;
  /** Real navigation — mutually exclusive with `bottomLinkOnPress`. */
  bottomLinkHref?: Href;
  /** A mock local action (e.g. "Resend code") instead of navigation — mutually exclusive with `bottomLinkHref`. */
  bottomLinkOnPress?: () => void;
};

export function AuthScreen({
  icon,
  headingAccent,
  headingRest = '',
  headingAccentColor = colors.primary,
  subtitle,
  subtitleColor = colors.textSecondary,
  children,
  ctaLabel,
  onSubmitCta,
  ctaLoading = false,
  bottomText,
  bottomLinkLabel,
  bottomLinkHref,
  bottomLinkOnPress,
}: AuthScreenProps) {
  const bottomLinkContent = bottomLinkLabel ? (
    <Text style={styles.bottomText}>
      {bottomText ? `${bottomText} ` : ''}
      <Text style={styles.bottomLinkStrong}>{bottomLinkLabel}</Text>
    </Text>
  ) : null;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.wordmark}>
            <FileoWordmark color={colors.textPrimary} width={100.5} height={25} />
          </View>

          {icon ? <View style={styles.icon}>{icon}</View> : null}

          <Text style={[styles.heading, !subtitle && styles.headingNoSubtitle]}>
            <Text style={{ color: headingAccentColor }}>{headingAccent}</Text>
            {headingRest}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
          ) : null}

          <View style={styles.fields}>{children}</View>

          <Button label={ctaLabel} variant="dark" loading={ctaLoading} onPress={onSubmitCta} />

          {bottomLinkLabel ? (
            bottomLinkOnPress ? (
              <Pressable onPress={bottomLinkOnPress} style={styles.bottomLink}>
                {bottomLinkContent}
              </Pressable>
            ) : (
              <Link href={bottomLinkHref!} style={styles.bottomLink}>
                {bottomLinkContent}
              </Link>
            )
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  wordmark: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  icon: {
    marginBottom: spacing.md,
  },
  heading: {
    ...typography.display,
    color: colors.textPrimary,
  },
  headingNoSubtitle: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  fields: {
    marginBottom: spacing.md,
  },
  bottomLink: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  bottomText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  bottomLinkStrong: {
    color: colors.primary,
    fontWeight: '600',
  },
});
