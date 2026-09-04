import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export default function OnboardingStepTwo() {
  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>File in Four Simple Steps</Text>
      <Text style={styles.description}>
        Connect your platforms, upload your documents, review your return, and submit — FILEO
        handles the tax math for you.
      </Text>
      <Button label="Next" onPress={() => router.push('/(onboarding)/step-3')} />
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
