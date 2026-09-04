import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendResetLink = () => {
    setSent(true);
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.subtitle}>
        Enter the email linked to your account and we&apos;ll send you a reset link.
      </Text>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      {sent ? <Text style={styles.confirmation}>Reset link sent — check your inbox.</Text> : null}

      <Button label="Send Reset Link" onPress={handleSendResetLink} />
      <Button
        label="Back to Sign In"
        variant="ghost"
        onPress={() => router.back()}
        style={styles.secondaryAction}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  confirmation: {
    ...typography.caption,
    color: colors.success,
    marginBottom: spacing.md,
  },
  secondaryAction: {
    marginTop: spacing.sm,
  },
});
