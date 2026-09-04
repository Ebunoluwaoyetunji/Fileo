import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <Screen>
      <Text style={styles.greeting}>Hi{user?.fullName ? `, ${user.fullName}` : ''} 👋</Text>
      <Text style={styles.subtitle}>Let&apos;s get your tax return filed.</Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Start a new filing</Text>
        <Text style={styles.cardBody}>
          Connect your platforms, upload documents, and let FILEO prepare your return.
        </Text>
        <Button label="Start Filing" onPress={() => router.push('/(app)/select-platform')} />
      </Card>

      <Button label="Sign Out" variant="ghost" onPress={handleSignOut} style={styles.signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
});
