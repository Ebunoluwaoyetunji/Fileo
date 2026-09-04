import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = () => {
    signIn({ id: 'local-user', fullName: 'FILEO User', email });
    router.replace('/(app)/home');
  };

  return (
    <Screen>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to continue your tax filing.</Text>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Link>

      <Button label="Sign In" onPress={handleSignIn} />

      <Link href="/(auth)/create-account" style={styles.createLink}>
        <Text style={styles.createLinkText}>
          Don&apos;t have an account? <Text style={styles.createLinkStrong}>Create one</Text>
        </Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotLinkText: {
    ...typography.caption,
    color: colors.primary,
  },
  createLink: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
  createLinkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  createLinkStrong: {
    color: colors.primary,
    fontWeight: '600',
  },
});
