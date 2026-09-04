/**
 * Home — from the Figma frame: a personalized greeting, a deadline notice
 * card, a filing CTA card, a floating "+" action button, and a bottom tab
 * bar. Both the card's "Start Filing now" button and the FAB go to the
 * same place: the first screen of the filing flow.
 *
 * The card's folder/document illustration is a placeholder — it's a
 * distinct piece of custom artwork (not just color/type/copy), so like
 * the onboarding illustrations it needs an actual exported asset from
 * Figma rather than being redrawn from a flat screenshot.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { layout, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

const FILING_ROUTE = '/(app)/select-platform' as const;

export default function HomeScreen() {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hey ${firstName}` : 'Hey there';

  const goToFiling = () => router.push(FILING_ROUTE);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>{greeting}</Text>

        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Tax filing deadline matter</Text>
          <Text style={styles.noticeBody}>
            Filing on time helps you stay compliant and avoid unnecessary penalties
          </Text>
        </Card>

        <Card style={styles.filingCard}>
          <Text style={styles.filingTitle}>File your 2025 tax return</Text>
          <Text style={styles.filingBody}>We&apos;ll guide you through the process, step by step.</Text>

          <View style={styles.illustrationPlaceholder}>
            <Text style={styles.illustrationPlaceholderText}>Illustration pending</Text>
          </View>

          <Button
            label="Start Filing now"
            variant="dark"
            onPress={goToFiling}
            style={styles.startFilingButton}
          />
        </Card>
      </ScrollView>

      <Pressable
        onPress={goToFiling}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Start a new filing"
      >
        <Ionicons name="add" size={28} color={colors.textInverse} />
      </Pressable>

      <BottomTabBar active="home" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  greeting: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  noticeCard: {
    backgroundColor: colors.warningLight,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  noticeTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noticeBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  filingCard: {
    backgroundColor: colors.forestDeep,
    borderWidth: 0,
  },
  filingTitle: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: colors.textInverse,
    marginBottom: spacing.xs,
  },
  filingBody: {
    ...typography.body,
    color: colors.textInverse,
    opacity: 0.9,
    marginBottom: spacing.md,
  },
  illustrationPlaceholder: {
    height: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  illustrationPlaceholderText: {
    ...typography.caption,
    color: colors.textInverse,
    opacity: 0.7,
  },
  startFilingButton: {
    alignSelf: 'flex-end',
  },
  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    bottom: spacing.xxl + spacing.md,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.backgroundInverse,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});
