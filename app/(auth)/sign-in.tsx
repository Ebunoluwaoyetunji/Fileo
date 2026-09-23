/**
 * Sign In — from the Figma frame the user provided for this screen (not a
 * copy of Create Account's layout details, just the same shared AuthScreen
 * component): fully-accent "Welcome Back" heading, dark subtitle, a plain
 * dark "Forgot Password?" link, and a "Log In" CTA.
 *
 * Real Supabase email/password sign-in. On success it hands off to
 * app/index.tsx, which decides between Home and (if the account never
 * finished it) Identity Verification.
 */
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function SignInScreen() {
  const { signIn, resendSignUpCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (isSubmitting) {
      return;
    }
    const trimmedEmail = email.trim();
    const missingEmail = trimmedEmail.length === 0;
    const missingPassword = password.length === 0;

    setEmailError(missingEmail ? 'Enter your email address.' : undefined);
    setPasswordError(missingPassword ? 'Enter your password.' : undefined);

    if (missingEmail || missingPassword) {
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(trimmedEmail, password);

    if (result.code === 'email_not_confirmed') {
      // Signed up but never entered their code (e.g. closed the app on OTP
      // Verification). Send a fresh one and pick up where they left off,
      // rather than showing an error they have no way to act on. If the
      // resend is rate-limited, the code from their earlier email still
      // works on that screen.
      await resendSignUpCode(trimmedEmail);
      setIsSubmitting(false);
      router.push({ pathname: '/(auth)/otp-verification', params: { email: trimmedEmail } });
      return;
    }

    setIsSubmitting(false);
    if (result.error) {
      if (result.code === 'invalid_credentials') {
        setPasswordError(result.error);
      } else {
        setToastMessage(result.error);
      }
      return;
    }

    router.replace('/');
  };

  return (
    <>
      <AuthScreen
        headingAccent="Welcome Back"
        headingRest=""
        subtitle="Manage your tax filing"
        subtitleColor={colors.textPrimary}
        ctaLabel="Log In"
        onSubmitCta={handleSignIn}
        ctaLoading={isSubmitting}
        bottomText="Don't have an account?"
        bottomLinkLabel="Sign Up"
        bottomLinkHref="/(auth)/create-account"
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
        <TextField
          label="Password"
          placeholder="Enter your password"
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          errorMessage={passwordError}
        />

        <ForgotPasswordLink />
      </AuthScreen>

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </>
  );
}

function ForgotPasswordLink() {
  return (
    <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
      <Text style={styles.forgotLinkText}>Forgot Password?</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotLinkText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
