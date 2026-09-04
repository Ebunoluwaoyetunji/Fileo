/**
 * Sign In — from the Figma frame the user provided for this screen (not a
 * copy of Create Account's layout details, just the same shared AuthScreen
 * component): fully-accent "Welcome Back" heading, dark subtitle, a plain
 * dark "Forgot Password?" link, and a "Log In" CTA.
 *
 * Auth here is a local mock only: there's no backend yet, so a non-empty
 * email + password is treated as a successful sign-in. Replace with real
 * authentication later.
 */
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const handleSignIn = () => {
    const trimmedEmail = email.trim();
    const missingEmail = trimmedEmail.length === 0;
    const missingPassword = password.length === 0;

    setEmailError(missingEmail ? 'Enter your email address.' : undefined);
    setPasswordError(missingPassword ? 'Enter your password.' : undefined);

    if (missingEmail || missingPassword) {
      return;
    }

    // Mock sign-in — no backend yet. Any non-empty email/password "succeeds".
    signIn({ id: 'local-user', fullName: 'FILEO User', email: trimmedEmail });
    router.replace('/(app)/home');
  };

  return (
    <AuthScreen
      headingAccent="Welcome Back"
      headingRest=""
      subtitle="Manage your tax filing"
      subtitleColor={colors.textPrimary}
      ctaLabel="Log In"
      onSubmitCta={handleSignIn}
      bottomText="Don't have an account?"
      bottomLinkLabel="Sign Up"
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
      <TextField
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        errorMessage={passwordError}
      />

      <ForgotPasswordLink />
    </AuthScreen>
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
