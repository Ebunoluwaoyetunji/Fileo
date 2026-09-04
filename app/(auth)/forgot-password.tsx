/**
 * Forgot Password — from the 3 Figma frames the user provided (form,
 * success, error). These read as one flow transitioning through states
 * (same wordmark position, no back/header chrome suggesting separate
 * routes) rather than 3 distinct screens, so they're modeled as local
 * state within this one route instead of extra files.
 *
 * Mock-only: there's no real email service or account lookup. To let both
 * the success and error paths be exercised, any email containing
 * "notfound" (case-insensitive) is treated as an unknown account —
 * anything else "succeeds". This is a test hook, not real validation.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/theme';

type Step = 'form' | 'success' | 'error';

const NOT_FOUND_TEST_FRAGMENT = 'notfound';

/** Keeps the first 3 / last 2 characters of the local part visible —
 * matches the Figma frame's "oye*************90@gmail.com" pattern. */
function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 5) {
    return email;
  }
  const start = local.slice(0, 3);
  const end = local.slice(-2);
  return `${start}${'*'.repeat(local.length - 5)}${end}@${domain}`;
}

function HelperNote({ text }: { text: string }) {
  return <Text style={styles.helperText}>{text}</Text>;
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [step, setStep] = useState<Step>('form');
  const [showResendToast, setShowResendToast] = useState(false);

  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setEmailError('Enter your email address.');
      return;
    }
    setEmailError(undefined);

    // Mock lookup — see the file header for how to trigger each branch.
    if (trimmedEmail.toLowerCase().includes(NOT_FOUND_TEST_FRAGMENT)) {
      setStep('error');
    } else {
      setStep('success');
    }
  };

  if (step === 'success') {
    return (
      <>
        <AuthScreen
          headingAccent="Check your email"
          subtitle={`We've sent a password reset link to ${maskEmail(email.trim())}`}
          subtitleColor={colors.textPrimary}
          ctaLabel="Done"
          onSubmitCta={() => router.replace('/(auth)/sign-in')}
          bottomLinkLabel="Resend link"
          bottomLinkOnPress={() => setShowResendToast(true)}
        >
          <HelperNote text="If you don't see it within a few minutes, check your spam folder or request another link." />
        </AuthScreen>

        <Toast
          visible={showResendToast}
          message="We've resent the password reset link."
          onHide={() => setShowResendToast(false)}
        />
      </>
    );
  }

  if (step === 'error') {
    return (
      <AuthScreen
        icon={<Ionicons name="alert-circle-outline" size={56} color={colors.warning} />}
        headingAccent="We couldn't find an account with that email address."
        headingAccentColor={colors.textPrimary}
        subtitle="Check the email and try again, or create a new account if you're new to Fileo."
        ctaLabel="Try again"
        onSubmitCta={handleSubmit}
        bottomLinkLabel="Create an account"
        bottomLinkHref="/(auth)/create-account"
      >
        <TextField
          label="Email address"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          errorMessage={emailError}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      headingAccent="Forgot your password?"
      subtitle="Enter the email address linked to your Fileo account. We'll send you a link to reset your password."
      subtitleColor={colors.textPrimary}
      ctaLabel="Send reset link"
      onSubmitCta={handleSubmit}
      bottomText="Remember your password?"
      bottomLinkLabel="Back to sign in"
      bottomLinkHref="/(auth)/sign-in"
    >
      <TextField
        label="Email address"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        errorMessage={emailError}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
