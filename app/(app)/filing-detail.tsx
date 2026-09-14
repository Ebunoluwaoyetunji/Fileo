/**
 * Filing detail — reached by tapping a filing under Filing History
 * (filing-history.tsx), for a closer look at one specific filing: a status
 * timeline, the amount involved, and what was actually filed (income
 * sources / deductions).
 *
 * No design frame for this exists yet — built to fit the app's existing
 * patterns instead: the back row matches document-detail.tsx /
 * info-page.tsx, the status timeline reuses the checkmark/ellipse step
 * style from filing-history.tsx's in-progress checklist, and the income/
 * deductions breakdown reuses return-review.tsx's detail-row styling.
 *
 * There's no backend, so a filing's "documents filed" are whatever
 * FilingContext captured at submission time (incomeSources/deductions) —
 * the closest thing to a document list that actually exists per entry.
 * MOCK_PRIOR_FILING (⚠️ illustrative, see filingContext.tsx) has none of
 * its own, so that section shows an explanatory empty state for it rather
 * than inventing figures.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Card } from '../../components/ui/Card';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { FilingHistoryEntry, MOCK_PRIOR_FILING, useFiling } from '../../state/filingContext';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

type TimelineStep = {
  id: string;
  label: string;
  complete: boolean;
};

function getTimelineSteps(entry: FilingHistoryEntry): TimelineStep[] {
  const isFiled = entry.status === 'Filed';
  return [
    { id: 'submitted', label: `Submitted · ${formatDate(entry.submittedAt)}`, complete: true },
    { id: 'review', label: 'Reviewed by FIRS', complete: isFiled },
    {
      id: 'filed',
      label: isFiled ? `Filed · ${formatNaira(entry.amountPaid ?? 0)} paid` : 'Filed',
      complete: isFiled,
    },
  ];
}

export default function FilingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { filingHistory } = useFiling();
  const [showReceiptToast, setShowReceiptToast] = useState(false);

  const entries = [...filingHistory, MOCK_PRIOR_FILING];
  const entry = entries.find((item) => item.id === id);

  if (!entry) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backLabel}>File</Text>
        </Pressable>
        <Text style={styles.notFoundText}>This filing couldn&apos;t be found.</Text>
      </Screen>
    );
  }

  const isFiled = entry.status === 'Filed';
  const isIllustrative = entry.id === MOCK_PRIOR_FILING.id;
  const steps = getTimelineSteps(entry);

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backLabel}>File</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{entry.taxYear} Tax Return</Text>
          <View style={[styles.statusPill, isFiled && styles.statusPillMuted]}>
            <Text style={[styles.statusPillText, isFiled && styles.statusPillTextMuted]}>
              {entry.status}
            </Text>
          </View>
        </View>

        <Card style={styles.timelineCard}>
          {steps.map((step, index) => (
            <View
              key={step.id}
              style={[styles.stepRow, index > 0 && styles.stepRowSpacing]}
            >
              <Ionicons
                name={step.complete ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={step.complete ? colors.success : colors.border}
              />
              <Text style={[styles.stepLabel, !step.complete && styles.stepLabelPending]}>
                {step.label}
              </Text>
            </View>
          ))}
        </Card>

        {isFiled ? (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Amount paid</Text>
              <Text style={styles.summaryValueStrong}>{formatNaira(entry.amountPaid ?? 0)}</Text>
            </View>
            <Pressable
              onPress={() => setShowReceiptToast(true)}
              style={styles.downloadReceiptRow}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.downloadReceiptText}>Download receipt</Text>
            </Pressable>
          </Card>
        ) : (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryLabel}>Total income</Text>
                <Text style={styles.summaryValueStrong}>{formatNaira(entry.totalIncome)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryLabel}>Total deductions</Text>
                <Text style={styles.summaryValueStrong}>{formatNaira(entry.totalDeductions)}</Text>
              </View>
            </View>
            <View style={styles.pendingNote}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.pendingNoteText}>
                Awaiting review — we&apos;ll update this once there&apos;s news.
              </Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Income sources filed</Text>
        <Card style={styles.detailCard}>
          {entry.incomeSources.length === 0 ? (
            <Text style={styles.detailEmpty}>
              {isIllustrative
                ? 'A per-filing income breakdown isn’t available for this illustrative prior-year entry.'
                : 'No income sources recorded.'}
            </Text>
          ) : (
            entry.incomeSources.map((source) => (
              <View key={source.id} style={styles.detailRow}>
                <PlatformIcon label={source.label} size={28} />
                <Text style={styles.detailRowLabel}>{source.label}</Text>
                <Text style={styles.detailRowValue}>{formatNaira(source.amount)}</Text>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionTitle}>Deductions & reliefs filed</Text>
        <Card style={styles.detailCard}>
          {entry.deductions.length === 0 ? (
            <Text style={styles.detailEmpty}>
              {isIllustrative
                ? 'A per-filing deductions breakdown isn’t available for this illustrative prior-year entry.'
                : 'No deductions claimed on this filing.'}
            </Text>
          ) : (
            entry.deductions.map((deduction) => (
              <View key={deduction.id} style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>{deduction.label}</Text>
                <Text style={styles.detailRowValue}>{formatNaira(deduction.amount)}</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <Toast
        visible={showReceiptToast}
        message="Downloading a receipt isn't available in this preview yet."
        onHide={() => setShowReceiptToast(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  notFoundText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.display,
    fontSize: 22,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusPill: {
    backgroundColor: '#DCEFE3',
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillMuted: {
    backgroundColor: colors.border,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  statusPillTextMuted: {
    color: colors.textSecondary,
  },
  timelineCard: {
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepRowSpacing: {
    marginTop: spacing.md,
  },
  stepLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  stepLabelPending: {
    color: colors.textSecondary,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
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
    color: colors.textSecondary,
  },
  summaryValueStrong: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  pendingNoteText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  downloadReceiptRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  downloadReceiptText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  detailCard: {
    marginBottom: spacing.lg,
  },
  detailEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailRowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  detailRowValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
});
