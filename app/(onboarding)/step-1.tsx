import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export default function OnboardingStepOne() {
  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>File Your Taxes Without the Stress</Text>
      <Text style={styles.description}>
        FILEO uses AI to prepare and file your Nigerian tax return in minutes, not weeks.
      </Text>
      <Button label="Next" onPress={() => router.push('/(onboarding)/step-2')} />
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
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
});
