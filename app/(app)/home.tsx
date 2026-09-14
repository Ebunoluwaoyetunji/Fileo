/**
 * Home — from the Figma frame: a personalized greeting, a deadline notice
 * card, a filing CTA card, a floating "+" action button, and a bottom tab
 * bar. Both the card's "Start Filing now" button and the FAB go to the
 * same place: the first screen of the filing flow.
 *
 * The filing card's background is the exported illustration itself (wave
 * texture + folder graphic baked in as one image) rather than a flat
 * color with a separate graphic — that's what the asset turned out to be.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { layout, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';
import { useFiling } from '../../state/filingContext';

const FILING_ROUTE = '/(app)/select-platform' as const;
const FILING_HISTORY_ROUTE = '/(app)/filing-history' as const;
const filingIllustration = require('../../assets/images/home-filing-illustration.png');

export default function HomeScreen() {
  const { user } = useAuth();
  const { filingHistory } = useFiling();
  // ⚠️ Placeholder UI (see filing-history.tsx) — same "already filed" data
  // driving the Filing tab is used here so this card and that tab can't
  // disagree with each other.
  const latestFiling = filingHistory[0];
  const firstName = user?.fullName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `Hey ${firstName}` : 'Hey there';

  const [showNotificationsToast, setShowNotificationsToast] = useState(false);

  const goToFiling = () => router.push(FILING_ROUTE);
  const goToFilingHistory = () => router.push(FILING_HISTORY_ROUTE);

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Pressable
            onPress={() => setShowNotificationsToast(true)}
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Tax filing deadline matter</Text>
          <Text style={styles.noticeBody}>
            Filing on time helps you stay compliant and avoid unnecessary penalties
          </Text>
        </Card>

        <Card style={styles.filingCard}>
          <Image
            source={filingIllustration}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {latestFiling ? (
            <>
              <View style={styles.submittedPill}>
                <Text style={styles.submittedPillText}>{latestFiling.status}</Text>
              </View>
              <Text style={styles.filingTitle}>Your {latestFiling.taxYear} return is submitted</Text>
              <Text style={styles.filingBody}>We&apos;ll notify you of any updates.</Text>

              <View style={styles.filingSpacer} />

              <Button
                label="View filing status"
                variant="dark"
                onPress={goToFilingHistory}
                style={styles.startFilingButton}
              />
            </>
          ) : (
            <>
              <Text style={styles.filingTitle}>File your 2025 tax return</Text>
              <Text style={styles.filingBody}>We&apos;ll guide you through the process, step by step.</Text>

              <View style={styles.filingSpacer} />

              <Button
                label="Start Filing now"
                variant="dark"
                onPress={goToFiling}
                style={styles.startFilingButton}
              />
            </>
          )}
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

      <Toast
        visible={showNotificationsToast}
        message="No new notifications."
        onHide={() => setShowNotificationsToast(false)}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.display,
    color: colors.textPrimary,
  },
  notificationButton: {
    padding: spacing.xs,
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
    overflow: 'hidden',
  },
  submittedPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  submittedPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textInverse,
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
  filingSpacer: {
    height: 130,
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
