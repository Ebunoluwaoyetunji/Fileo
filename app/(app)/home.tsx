/**
 * Home — two very different states depending on whether the user has ever
 * filed:
 *
 * Not yet filed: the original Figma frame — deadline notice card + filing
 * CTA card (the illustration image as its background) — unchanged.
 *
 * ⚠️ Already filed ("returning user"): from a new screenshot the user
 * attached, reviewed against the previous placeholder implementation.
 * Reconciled a few things the screenshot alone didn't settle:
 *  - The screenshot's greeting ("Good Morning Sharon") is time-of-day
 *    based, not the earlier static "Hey [name]" — implemented for real
 *    using the device's own clock (Good Morning / Afternoon / Evening).
 *  - Two attached screenshots showed the "Quick Stats" cards two different
 *    ways (a horizontally-cut-off row vs. stacked full-width, with "Total
 *    saved" only visible in the stacked one). Built as one horizontally
 *    scrollable row containing all 3 (Total saved, Years filed, Penalties)
 *    — keeps the "Quick Stats" section heading, and reads as the more
 *    complete version of the two.
 *  - "Total saved" is computed for real: MOCK_TAX_RATE (the same 15% used
 *    on Return Review) against total deductions across past filings — not
 *    a hardcoded figure.
 *  - "Years filed" and "Recent Activity" both include MOCK_PRIOR_FILING
 *    (⚠️ illustrative, see filingContext.tsx) alongside the real
 *    filingHistory entries, same as the Filing tab's history state.
 *  - Recent Activity's "Completed" pill is shown as a fixed label per row
 *    rather than that entry's real status ('Submitted'/'Filed') — it
 *    reads here as "you finished submitting this one," a simpler framing
 *    that doesn't conflict with the more detailed status already shown on
 *    the Filing tab.
 *  - The deadline notice card doesn't make sense once compliant, so it
 *    only shows in the not-yet-filed state; "View filing receipt" routes
 *    to the Filing tab (same as the old CTA), since there's no real
 *    receipt file behind a still-'Submitted' filing to show directly.
 *  - "Your next filing" dates are computed (next year, and that year + 1
 *    for when its period "opens") rather than hardcoded, so they don't go
 *    stale.
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
import { GradientBackground } from '../../components/ui/GradientBackground';
import { colors } from '../../constants/colors';
import { layout, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';
import { MOCK_PRIOR_FILING, MOCK_TAX_RATE, useFiling } from '../../state/filingContext';

const FILING_ROUTE = '/(app)/select-platform' as const;
const FILING_HISTORY_ROUTE = '/(app)/filing-history' as const;
const filingIllustration = require('../../assets/images/home-filing-illustration.png');

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getTimeGreeting(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

type StatVariant = 'mint' | 'tan';

const STAT_VARIANT_STYLES: Record<StatVariant, { bg: string; border: string }> = {
  mint: { bg: colors.primaryLight, border: colors.success },
  tan: { bg: colors.warningLight, border: colors.warning },
};

function StatCard({
  label,
  value,
  body,
  variant,
}: {
  label: string;
  value: string;
  body: string;
  variant: StatVariant;
}) {
  const variantStyle = STAT_VARIANT_STYLES[variant];
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: variantStyle.bg, borderColor: variantStyle.border },
      ]}
    >
      <View style={styles.statHeaderRow}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statBody}>{body}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { filingHistory } = useFiling();
  const latestFiling = filingHistory[0];
  // Same "already filed" entries the Filing tab's history state shows —
  // real entries plus the one illustrative prior year, so the two screens
  // can't disagree.
  const historyEntries = latestFiling ? [...filingHistory, MOCK_PRIOR_FILING] : [];
  const totalSaved = Math.round(
    historyEntries.reduce((sum, entry) => sum + entry.totalDeductions, 0) * MOCK_TAX_RATE
  );
  const nextFilingYear = latestFiling ? parseInt(latestFiling.taxYear, 10) + 1 : undefined;

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const [now] = useState(() => new Date());
  const timeGreeting = getTimeGreeting(now.getHours());
  const greeting = firstName ? `${timeGreeting} ${firstName}` : timeGreeting;

  const goToFiling = () => router.push(FILING_ROUTE);
  const goToFilingHistory = () => router.push(FILING_HISTORY_ROUTE);
  const goToNotifications = () => router.push('/(app)/notifications');

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Pressable
            onPress={goToNotifications}
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        {latestFiling ? (
          <>
            <GradientBackground
              colors={[colors.backgroundInverse, colors.forestDeep]}
              style={styles.complianceCard}
              contentStyle={styles.complianceCardContent}
            >
              <View>
                <View style={styles.compliantPill}>
                  <Text style={styles.compliantPillText}>You&apos;re tax compliant</Text>
                </View>
                <Text style={styles.complianceText}>
                  Your {latestFiling.taxYear} tax return was filed on{' '}
                  {formatDate(latestFiling.submittedAt)}.
                </Text>
              </View>
              <Button
                label="View filing receipt"
                variant="dark"
                onPress={goToFilingHistory}
                style={styles.receiptButton}
              />
            </GradientBackground>

            <Text style={styles.sectionTitle}>Quick Stats</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsRow}
              style={styles.statsScroll}
            >
              <StatCard
                label="Total saved"
                value={formatNaira(totalSaved)}
                body="Estimated tax savings from eligible deductions."
                variant="mint"
              />
              <StatCard
                label="Years filed"
                value={String(historyEntries.length)}
                body="Tax years completed through Fileo."
                variant="tan"
              />
              <StatCard
                label="Penalties"
                value={formatNaira(0)}
                body="No outstanding penalties."
                variant="mint"
              />
            </ScrollView>

            <Card style={styles.activityCard}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              {historyEntries.map((entry, index) => (
                <View
                  key={entry.id}
                  style={[styles.activityRow, index > 0 && styles.activityRowDivider]}
                >
                  <View style={styles.activityLeft}>
                    <Text style={styles.activityRowTitle}>{entry.taxYear} Tax Return</Text>
                    <Text style={styles.activityRowMeta}>
                      Filed on {formatDate(entry.submittedAt)}
                    </Text>
                  </View>
                  <View style={styles.completedPill}>
                    <Text style={styles.completedPillText}>Completed</Text>
                  </View>
                </View>
              ))}
            </Card>

            {nextFilingYear !== undefined ? (
              <View style={styles.nextFilingNote}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={colors.primaryDark}
                  style={styles.nextFilingIcon}
                />
                <View style={styles.nextFilingTextWrap}>
                  <Text style={styles.nextFilingTitle}>Your next filing</Text>
                  <Text style={styles.nextFilingBody}>
                    The {nextFilingYear} filing period opens on 1 January {nextFilingYear + 1}.
                    We&apos;ll remind you when it&apos;s time to file.
                  </Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
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
              <Text style={styles.filingTitle}>File your 2025 tax return</Text>
              <Text style={styles.filingBody}>
                We&apos;ll guide you through the process, step by step.
              </Text>

              <View style={styles.filingSpacer} />

              <Button
                label="Start Filing now"
                variant="dark"
                onPress={goToFiling}
                style={styles.startFilingButton}
              />
            </Card>
          </>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.display,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  notificationButton: {
    padding: spacing.xs,
  },

  // --- Already-filed state ---
  complianceCard: {
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    // A definite (not min-) height, not just content-driven sizing — the
    // gradient SVG's own width="100%"/height="100%" only resolves against
    // a parent with a definite size; a plain flex/auto-sized box lets the
    // pill/text/button lay out fine but leaves the fill invisible behind
    // them, same underlying issue this component's own header comment
    // flags for the padding case. Generous enough for the current content
    // (pill + 1-2 line filing sentence + button) without feeling cramped.
    height: 220,
  },
  complianceCardContent: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  compliantPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    marginBottom: spacing.md,
  },
  compliantPillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  complianceText: {
    ...typography.body,
    color: colors.textInverse,
    marginBottom: spacing.lg,
  },
  receiptButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    ...typography.display,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsScroll: {
    marginHorizontal: -layout.screenPadding,
    marginBottom: spacing.lg,
  },
  statsRow: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.md,
  },
  statCard: {
    width: 220,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  activityCard: {
    marginBottom: spacing.lg,
  },
  activityTitle: {
    ...typography.display,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  activityRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  activityLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  activityRowTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityRowMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  completedPill: {
    backgroundColor: '#DCEFE3',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  completedPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  nextFilingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  nextFilingIcon: {
    marginTop: 2,
  },
  nextFilingTextWrap: {
    flex: 1,
  },
  nextFilingTitle: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
    marginBottom: spacing.xs / 2,
  },
  nextFilingBody: {
    ...typography.caption,
    color: colors.primaryDark,
  },

  // --- Not-yet-filed state ---
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
