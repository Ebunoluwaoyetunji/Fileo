import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

export default function ConfirmationScreen() {
  const { resetFiling } = useFiling();

  const handleBackToHome = () => {
    resetFiling();
    router.replace('/(app)/home');
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Return submitted!</Text>
      <Text style={styles.subtitle}>
        Your tax return has been filed. You&apos;ll get a confirmation from FIRS shortly.
      </Text>

      <Button label="Back to Home" onPress={handleBackToHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
