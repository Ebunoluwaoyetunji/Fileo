/**
 * Shared layout for the auth forms (Create Account, Sign In): centered
 * wordmark, a heading (an accent-colored lead word/phrase, optionally
 * followed by a dark serif remainder — pass an empty `headingRest` for an
 * all-accent heading), a body subtitle, the form fields, a full-width dark
 * CTA, and a bottom link row. Create Account and Sign In each have their
 * own Figma frame with slightly different heading/subtitle treatments, but
 * share this same structural layout.
 */
import { Href, Link } from 'expo-router';
import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { Button } from '../ui/Button';
import { FileoWordmark } from '../ui/FileoWordmark';
import { Screen } from './Screen';

type AuthScreenProps = {
  /** Accent-colored lead word(s) of the heading, e.g. "Create". */
  headingAccent: string;
  /** Rest of the heading in the default dark color, e.g. " your Fileo account". */
  headingRest: string;
  subtitle: string;
  /** Defaults to the muted secondary color; some frames use the dark primary text color instead. */
  subtitleColor?: string;
  children: ReactNode;
  ctaLabel: string;
  onSubmitCta: () => void;
  ctaLoading?: boolean;
  bottomText: string;
  bottomLinkLabel: string;
  bottomLinkHref: Href;
};

export function AuthScreen({
  headingAccent,
  headingRest,
  subtitle,
  subtitleColor = colors.textSecondary,
  children,
  ctaLabel,
  onSubmitCta,
  ctaLoading = false,
  bottomText,
  bottomLinkLabel,
  bottomLinkHref,
}: AuthScreenProps) {
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

          <Text style={styles.heading}>
            <Text style={styles.headingAccent}>{headingAccent}</Text>
            {headingRest}
          </Text>
          <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>

          <View style={styles.fields}>{children}</View>

          <Button label={ctaLabel} variant="dark" loading={ctaLoading} onPress={onSubmitCta} />

          <Link href={bottomLinkHref} style={styles.bottomLink}>
            <Text style={styles.bottomText}>
              {bottomText} <Text style={styles.bottomLinkStrong}>{bottomLinkLabel}</Text>
            </Text>
          </Link>
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
  heading: {
    ...typography.display,
    color: colors.textPrimary,
  },
  headingAccent: {
    color: colors.primary,
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
