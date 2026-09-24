/**
 * Filing detail — reached by tapping a filing under Filing History
 * (filing-history.tsx): its status and progress, reference number, the
 * totals, and what was filed (income sources / deductions). Loaded fresh
 * from the database each time it opens, so status changes made on the
 * server show up.
 *
 * No design frame for this exists yet — built to fit the app's existing
 * patterns: the back row matches document-detail.tsx / info-page.tsx, the
 * status timeline reuses the checkmark/ellipse step style from
 * filing-history.tsx's in-progress checklist, and the income/deductions
 * breakdown reuses return-review.tsx's detail-row styling.
 *
 * ⚠️ No design for the loading / couldn't-load states, the reference line,
 * or the Processing / Rejected statuses.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { Filing, getFiling, STATUS_LABELS } from '../../lib/filings';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

type TimelineStep = {
  id: string;
  label: string;
  state: 'complete' | 'pending' | 'failed';
};

function getTimelineSteps(filing: Filing): TimelineStep[] {
  const { status } = filing;
  const reviewed = status === 'completed' || status === 'rejected';
  return [
    {
      id: 'submitted',
      label: `Submitted · ${formatDate(filing.submittedAt ?? filing.updatedAt)}`,
      state: 'complete',
    },
    {
      id: 'review',
      label: status === 'processing' ? 'Being reviewed' : 'Reviewed by FIRS',
      state: reviewed ? 'complete' : 'pending',
    },
    status === 'rejected'
      ? { id: 'rejected', label: 'Rejected', state: 'failed' }
      : { id: 'filed', label: 'Filed', state: status === 'completed' ? 'complete' : 'pending' },
  ];
}

const PENDING_NOTES: Record<string, string> = {
  submitted: 'Awaiting review — we’ll update this once there’s news.',
  processing: 'Being processed — we’ll update this once there’s news.',
  rejected: 'This return needs attention. We’ll be in touch about next steps.',
};

export default function FilingDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [filing, setFiling] = useState<Filing | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'missing' | 'error'>('loading');
  const [showReceiptToast, setShowReceiptToast] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoadState('missing');
      return;
    }
    setLoadState('loading');
    const result = await getFiling(id);
    if (result.error) {
      setLoadState('error');
      return;
    }
    // Only submitted returns belong here; a draft is resumed from the File tab.
    if (!result.filing || result.filing.status === 'draft') {
      setLoadState('missing');
      return;
    }
    setFiling(result.filing);
    setLoadState('loaded');
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const backRow = (
    <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
      <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      <Text style={styles.backLabel}>File</Text>
    </Pressable>
  );

  if (loadState !== 'loaded' || !filing) {
    return (
      <Screen>
        {backRow}
        {loadState === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : loadState === 'error' ? (
          <>
            <Text style={styles.notFoundText}>
              Couldn&apos;t load this filing. Check your connection and try again.
            </Text>
            <Button label="Try again" variant="secondary" onPress={load} style={styles.retryButton} />
          </>
        ) : (
          <Text style={styles.notFoundText}>This filing couldn&apos;t be found.</Text>
        )}
      </Screen>
    );
  }

  const isFiled = filing.status === 'completed';
  const isRejected = filing.status === 'rejected';
  const steps = getTimelineSteps(filing);

  return (
    <Screen>
      {backRow}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{filing.taxYear} Tax Return</Text>
          <View style={[styles.statusPill, (isFiled || isRejected) && styles.statusPillMuted]}>
            <Text
              style={[
                styles.statusPillText,
                isFiled && styles.statusPillTextMuted,
                isRejected && styles.statusPillTextRejected,
              ]}
            >
              {STATUS_LABELS[filing.status]}
            </Text>
          </View>
        </View>
        {filing.reference ? (
          <Text style={styles.reference} selectable>
            Reference {filing.reference}
          </Text>
        ) : null}

        <Card style={styles.timelineCard}>
          {steps.map((step, index) => (
            <View key={step.id} style={[styles.stepRow, index > 0 && styles.stepRowSpacing]}>
              <Ionicons
                name={
                  step.state === 'complete'
                    ? 'checkmark-circle'
                    : step.state === 'failed'
                      ? 'close-circle'
                      : 'ellipse-outline'
                }
                size={20}
                color={
                  step.state === 'complete'
                    ? colors.success
                    : step.state === 'failed'
                      ? colors.danger
                      : colors.border
                }
              />
              <Text style={[styles.stepLabel, step.state === 'pending' && styles.stepLabelPending]}>
                {step.label}
              </Text>
            </View>
          ))}
        </Card>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Total income</Text>
              <Text style={styles.summaryValueStrong}>{formatNaira(filing.totalIncome)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryColumn}>
              <Text style={styles.summaryLabel}>Total deductions</Text>
              <Text style={styles.summaryValueStrong}>{formatNaira(filing.totalDeductions)}</Text>
            </View>
          </View>
          {isFiled ? (
            <Pressable
              onPress={() => setShowReceiptToast(true)}
              style={styles.downloadReceiptRow}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.downloadReceiptText}>Download receipt</Text>
            </Pressable>
          ) : (
            <View style={styles.pendingNote}>
              <Ionicons
                name={isRejected ? 'alert-circle-outline' : 'time-outline'}
                size={14}
                color={isRejected ? colors.danger : colors.textSecondary}
              />
              <Text style={styles.pendingNoteText}>{PENDING_NOTES[filing.status]}</Text>
            </View>
          )}
        </Card>

        <Text style={styles.sectionTitle}>Income sources filed</Text>
        <Card style={styles.detailCard}>
          {filing.incomeSources.length === 0 ? (
            <Text style={styles.detailEmpty}>No income sources recorded.</Text>
          ) : (
            filing.incomeSources.map((source) => (
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
          {filing.deductions.length === 0 ? (
            <Text style={styles.detailEmpty}>No deductions claimed on this filing.</Text>
          ) : (
            filing.deductions.map((deduction) => (
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
  statusPillTextRejected: {
    color: colors.danger,
  },
  reference: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  loading: {
    marginTop: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.md,
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
