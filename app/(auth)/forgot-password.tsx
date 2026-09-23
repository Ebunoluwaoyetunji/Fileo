/**
 * Forgot Password — from the Figma frames the user provided (form and
 * "Check your email"), modeled as local state within this one route.
 *
 * Real Supabase password reset with a 6-digit code (no email links — the
 * app has no deep-link handling for auth):
 *   1. here: resetPasswordForEmail() emails a code, if the account exists
 *   2. OTP Verification (purpose=recovery): verifyOtp type 'recovery'
 *   3. Reset Password: the new password is saved
 *
 * The confirmation is the same neutral message for every email, whether or
 * not it has an account, so this screen can't be used to find out who's
 * registered. That's why the Figma "We couldn't find an account with that
 * email address" frame is no longer used.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

type Step = 'form' | 'sent';

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
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [step, setStep] = useState<Step>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setEmailError('Enter your email address.');
      return;
    }
    setEmailError(undefined);

    setIsSubmitting(true);
    const result = await requestPasswordReset(trimmedEmail);
    setIsSubmitting(false);
    // Only a connection problem or a malformed address comes back as an
    // error; everything else (including "no such account") looks like
    // success on purpose.
    if (result.error) {
      setEmailError(result.error);
      return;
    }
    setStep('sent');
  };

  if (step === 'sent') {
    const trimmedEmail = email.trim();
    return (
      <AuthScreen
        headingAccent="Check your email"
        subtitle={`If an account exists for ${maskEmail(trimmedEmail)}, we've sent a 6-digit code to reset your password.`}
        subtitleColor={colors.textPrimary}
        ctaLabel="Enter code"
        onSubmitCta={() =>
          router.push({
            pathname: '/(auth)/otp-verification',
            params: { purpose: 'recovery', email: trimmedEmail },
          })
        }
        bottomLinkLabel="Use a different email"
        bottomLinkOnPress={() => setStep('form')}
      >
        <HelperNote text="If you don't see it within a few minutes, check your spam folder. You can request a new code on the next screen." />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      headingAccent="Forgot your password?"
      subtitle="Enter the email address linked to your Fileo account. We'll send you a code to reset your password."
      subtitleColor={colors.textPrimary}
      ctaLabel="Send code"
      onSubmitCta={handleSubmit}
      ctaLoading={isSubmitting}
      bottomText="Remember your password?"
      bottomLinkLabel="Back to sign in"
      bottomLinkHref="/(auth)/sign-in"
    >
      <TextField
        label="Email address"
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
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
