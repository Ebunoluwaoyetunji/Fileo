import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

export default function SplashScreen() {
  return (
    <Screen style={styles.container}>
      <Text style={styles.wordmark}>FILEO</Text>
      <Text style={styles.tagline}>AI-native tax filing for Nigeria</Text>
      <Button label="Get Started" onPress={() => router.push('/(onboarding)/step-1')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmark: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
