import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function OnboardingStepThree() {
  const { completeOnboarding } = useAuth();

  const handleFinish = () => {
    completeOnboarding();
    router.replace('/(auth)/sign-in');
  };

  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>Your Data Is Safe</Text>
      <Text style={styles.description}>
        Your documents and personal information are encrypted end-to-end and never shared without
        your consent.
      </Text>
      <Button label="Finish" onPress={handleFinish} />
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
