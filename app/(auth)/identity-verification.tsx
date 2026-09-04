import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function IdentityVerificationScreen() {
  const { signIn } = useAuth();
  const [bvn, setBvn] = useState('');

  const handleVerify = () => {
    signIn({ id: 'local-user', fullName: 'FILEO User', email: '' });
    router.replace('/(app)/home');
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>
        We use your BVN or NIN to confirm your identity with FIRS. This never leaves FILEO
        unencrypted.
      </Text>

      <TextField
        label="BVN or NIN"
        placeholder="11 digits"
        keyboardType="number-pad"
        value={bvn}
        onChangeText={setBvn}
      />

      <Button label="Verify Identity" onPress={handleVerify} />
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
});
