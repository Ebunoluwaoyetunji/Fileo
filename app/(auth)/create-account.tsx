import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export default function CreateAccountScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const handleCreateAccount = () => {
    router.push('/(auth)/otp-verification');
  };

  return (
    <Screen>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>It only takes a couple of minutes.</Text>

      <TextField label="Full name" placeholder="Ada Lovelace" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Phone number"
        placeholder="+234"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />

      <Button label="Create Account" onPress={handleCreateAccount} />
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
});
