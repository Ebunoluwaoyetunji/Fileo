/**
 * Sign In — shares the Create Account frame's layout/pattern (the user
 * confirmed there's no separate Sign In design). Auth here is a local mock
 * only: there's no backend yet, so a non-empty email + password is treated
 * as a successful sign-in. Replace with real authentication later.
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
      headingAccent="Welcome"
      headingRest=" back"
      subtitle="Sign in to continue your tax filing."
      ctaLabel="Sign In"
      onSubmitCta={handleSignIn}
      bottomText="Don't have an account?"
      bottomLinkLabel="Create one"
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
      <Text style={styles.forgotLinkText}>Forgot password?</Text>
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
    color: colors.primary,
  },
});
