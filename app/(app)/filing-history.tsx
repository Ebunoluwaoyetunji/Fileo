/**
 * Filing History — the screen behind the bottom nav's "File" tab, which
 * previously had no screen (and no onPress) behind it at all.
 *
 * ⚠️ PLACEHOLDER UI — there is no Figma frame for this screen yet. This is
 * a reasonable-default design built from existing patterns/theme tokens
 * (Card, Button, the status-pill style from confirmation.tsx) so the tab
 * isn't dead, not a final design. It's deliberately self-contained in this
 * one file so it's easy to swap out wholesale once a real frame exists —
 * only the underlying state (FilingContext's `filingHistory`) and the tab
 * bar's route to this screen are meant to survive that swap.
 *
 * Since there's no multi-year filing support yet, `filingHistory` only
 * ever grows to one entry today (recorded once, in confirmation.tsx) — but
 * this renders it as a list regardless, so it doesn't need reshaping when
 * that changes.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';
import type { FilingHistoryEntry } from '../../state/filingContext';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatSubmittedDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function FilingCard({ entry }: { entry: FilingHistoryEntry }) {
  return (
    <Card style={styles.filingCard}>
      <View style={styles.filingCardHeader}>
        <Text style={styles.taxYear}>{entry.taxYear} tax return</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{entry.status}</Text>
        </View>
      </View>
      <Text style={styles.submittedOn}>Submitted {formatSubmittedDate(entry.submittedAt)}</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryColumn}>
          <Text style={styles.summaryLabel}>Total income</Text>
          <Text style={styles.summaryValue}>{formatNaira(entry.totalIncome)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryColumn}>
          <Text style={styles.summaryLabel}>Total deductions</Text>
          <Text style={styles.summaryValue}>{formatNaira(entry.totalDeductions)}</Text>
        </View>
      </View>

      <View style={styles.pendingNote}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.pendingNoteText}>Awaiting review — we&apos;ll update this once there&apos;s news.</Text>
      </View>
    </Card>
  );
}

export default function FilingHistoryScreen() {
  const { filingHistory } = useFiling();
  const hasFilings = filingHistory.length > 0;

  const goToFiling = () => router.push('/(app)/select-platform');

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Filing history</Text>

        {hasFilings ? (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {filingHistory.map((entry) => (
              <FilingCard key={entry.id} entry={entry} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>You haven&apos;t filed a return yet</Text>
            <Text style={styles.emptyBody}>
              Once you file, your submitted returns and their status will show up here.
            </Text>
            <Button label="Start Filing" onPress={goToFiling} style={styles.emptyButton} />
          </View>
        )}
      </View>

      <BottomTabBar active="file" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  filingCard: {
    marginBottom: spacing.md,
  },
  filingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  taxYear: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  statusPill: {
    backgroundColor: '#DCEFE3',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  submittedOn: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryColumn: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  summaryValue: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pendingNoteText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
  },
});
