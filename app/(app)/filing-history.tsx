/**
 * Filing History — the screen behind the bottom nav's "File" tab. Everything
 * here loads from the user's filings in Supabase (FilingContext), and
 * reloads whenever the tab is shown, so status changes made on the server
 * (processing, filed, rejected) appear.
 *
 * States (per the user's own designs):
 *  - not-started (no draft and no history): the design tool's own layout/
 *    copy, with the "dark" Button variant (colors.backgroundInverse), the
 *    same one Home uses for the identical "start a filing" action. The tax
 *    year and deadline line follow the current tax year.
 *  - in-progress (a draft exists): a resume screen — the 5-step checklist
 *    and the documents still needed, from what's saved on the draft, plus
 *    any past filings below it (history and in-progress show together).
 *    "Continue filing" opens the draft at its saved step. "Documents still
 *    needed" is the server's own list of empty document slots (platform
 *    statements and deduction documents — auto-pulled banks never need
 *    one), and each "Upload" is a real upload that fills that slot.
 *  - history (no draft, past filings): the list of submitted returns, each
 *    tapping through to filing-detail.tsx. "Start {year} filing" only shows
 *    while the current tax year hasn't been filed yet.
 *
 * ⚠️ No design for the loading and couldn't-load states, or for the
 * Processing / Rejected statuses — built from the existing styles.
 */
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  UploadErrorRow,
  UploadingRow,
  useDocumentUploader,
} from '../../components/documents/useDocumentUploader';
import { useMissingItems, useStartFiling } from '../../components/filing/FilingFlow';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { isNigerianBank } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { formatNaira } from '../../lib/money';
import {
  currentTaxYear,
  deductionsTotalKobo,
  describeMissingItem,
  Filing,
  MissingItem,
  STATUS_LABELS,
  stepIndex,
} from '../../lib/filings';
import { FilingHistoryEntry, useFiling } from '../../state/filingContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Personal income tax returns are due by 31 March of the following year. */
function deadlineLine(taxYear: number) {
  const deadline = new Date(taxYear + 1, 2, 31, 23, 59, 59);
  return Date.now() > deadline.getTime()
    ? `The deadline passed on 31 March ${taxYear + 1}. Filing now limits what you owe.`
    : `The deadline is 31 March ${taxYear + 1}. Filing early avoids penalties.`;
}

function NotStartedState() {
  const { start, isStarting, error, clearError } = useStartFiling();
  const taxYear = currentTaxYear();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name="file-plus-outline" size={36} color={colors.textPrimary} />
      </View>
      <Text style={styles.emptyTitle}>You haven&apos;t filed for {taxYear} yet</Text>
      <Text style={styles.emptyBody}>{deadlineLine(taxYear)}</Text>
      {/* "dark" variant — see file header on why this differs from the
          design tool's own button color. */}
      <Button
        label="File now"
        variant="dark"
        onPress={start}
        loading={isStarting}
        style={styles.emptyButton}
      />
      <Toast key={error ?? 'none'} visible={error !== null} message={error ?? ''} onHide={clearError} />
    </View>
  );
}

function InProgressState({ draft }: { draft: Filing }) {
  const { filingHistory, addUploadedDocument } = useFiling();
  const { start, isStarting, error: startError, clearError } = useStartFiling();
  const uploader = useDocumentUploader();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Completeness comes from the server's own rules (the same ones submit
  // checks); until that answer arrives, the checklist falls back to what's
  // saved on the draft.
  const { items: missingItems, recheck } = useMissingItems(draft.id);
  const missing = (missingItems ?? []).map(describeMissingItem);
  const has = (type: MissingItem['type']) => (missingItems ?? []).some((item) => item.type === type);

  const platformsDone = draft.platforms.length > 0;
  const documentsDone = missingItems
    ? platformsDone && !has('platform_document')
    : platformsDone &&
      draft.platforms.filter((p) => !isNigerianBank(p)).every((p) => !!draft.documentIdsByKey[p]);
  const incomeDone =
    stepIndex(draft.currentStep) > stepIndex('income_summary') &&
    (missingItems
      ? !has('income_amount') &&
        !has('income_unconfirmed') &&
        !has('ai_amount_unconfirmed') &&
        !has('flagged_transactions')
      : !!draft.incomeConfirmedAt && draft.incomeSources.every((s) => s.amountKobo !== null));
  const deductionsDone = draft.currentStep === 'return_review';

  const steps = [
    { id: 'income-source', label: 'Income source selected', complete: platformsDone },
    { id: 'documents-uploaded', label: 'Documents uploaded', complete: documentsDone },
    { id: 'income-confirmed', label: 'Income confirmed', complete: incomeDone },
    { id: 'deductions-added', label: 'Deductions & Reliefs added', complete: deductionsDone },
    { id: 'return-submitted', label: 'Return reviewed & Submitted', complete: false },
  ];
  const completedCount = steps.filter((s) => s.complete).length;
  const percent = Math.round((completedCount / steps.length) * 100);

  // Every missing document — platform statements and deduction documents.
  const neededDocuments = missing.flatMap((item) =>
    item.document ? [{ ...item.document, isPlatform: item.id.startsWith('platform:') }] : []
  );

  const subtitle =
    neededDocuments.length > 0
      ? `You are ${percent}% through. ${neededDocuments.length} document${
          neededDocuments.length === 1 ? '' : 's'
        } still needed.`
      : `You are ${percent}% through.`;

  const handleUpload = (doc: (typeof neededDocuments)[number]) => {
    uploader.start({
      key: doc.slotKey,
      source: doc.isPlatform ? 'upload_step' : 'deductions',
      category: doc.category,
      taxYear: draft.taxYear,
      onUploaded: async (document) => {
        const { error } = await addUploadedDocument(doc.slotKey, document.id);
        setToastMessage(
          error
            ? 'Document uploaded, but we couldn’t add it to your return. Open your return and tap Continue to try again.'
            : 'Document uploaded.'
        );
        recheck();
      },
    });
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.inProgressContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your {draft.taxYear} return</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.stepsComplete}>
          {completedCount} of {steps.length} steps complete.
        </Text>

        <Card style={styles.stepsCard}>
          {steps.map((step) => (
            <View key={step.id} style={styles.stepRow}>
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

        {neededDocuments.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Documents still needed</Text>
            {neededDocuments.map((doc) => {
              const uploadState = uploader.slot(doc.slotKey);
              return (
                <Card key={doc.slotKey} style={styles.neededDocCardWrap}>
                  <View style={styles.neededDocRow}>
                    <View style={styles.neededDocLeft}>
                      <Text style={styles.neededDocLabel}>{doc.name}</Text>
                      <Pressable
                        onPress={() =>
                          setToastMessage(
                            "Instructions for this document aren't available in this preview yet."
                          )
                        }
                        hitSlop={8}
                        style={styles.howToRow}
                        accessibilityRole="button"
                      >
                        <Text style={styles.howToText}>How to get this</Text>
                        <Ionicons name="open-outline" size={13} color={colors.primary} />
                      </Pressable>
                    </View>
                    {uploadState.status === 'uploading' ? (
                      <UploadingRow />
                    ) : (
                      <Pressable onPress={() => handleUpload(doc)} hitSlop={8} accessibilityRole="button">
                        <Text style={styles.uploadLink}>Upload</Text>
                      </Pressable>
                    )}
                  </View>
                  <UploadErrorRow state={uploadState} onRetry={() => uploader.retry(doc.slotKey)} />
                </Card>
              );
            })}
          </>
        ) : null}

        {filingHistory.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Filing History</Text>
            {filingHistory.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} />
            ))}
          </>
        ) : null}
      </ScrollView>

      <Button
        label="Continue filing"
        variant="dark"
        onPress={start}
        loading={isStarting}
        style={styles.continueFilingButton}
      />

      <Toast
        key={toastMessage ?? 'none'}
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
      <Toast
        key={`start-${startError ?? 'none'}`}
        visible={startError !== null}
        message={startError ?? ''}
        onHide={clearError}
      />
      {uploader.sheets}
    </>
  );
}

const PENDING_NOTES: Record<string, string> = {
  submitted: 'Awaiting review — we’ll update this once there’s news.',
  processing: 'Being processed — we’ll update this once there’s news.',
  rejected: 'This return needs attention. We’ll be in touch about next steps.',
};

function HistoryCard({ entry }: { entry: FilingHistoryEntry }) {
  const [showReceiptToast, setShowReceiptToast] = useState(false);
  const isFiled = entry.status === 'completed';
  const isRejected = entry.status === 'rejected';

  const goToDetail = () =>
    router.push({ pathname: '/(app)/filing-detail', params: { id: entry.id } });

  return (
    <Pressable
      onPress={goToDetail}
      accessibilityRole="button"
      accessibilityLabel={`View ${entry.taxYear} tax return details`}
    >
      <Card style={styles.filingCard}>
        <View style={styles.filingCardHeader}>
          <Text style={styles.taxYear}>{entry.taxYear} tax return</Text>
          <View style={styles.filingCardHeaderRight}>
            <View style={[styles.statusPill, (isFiled || isRejected) && styles.statusPillMuted]}>
              <Text
                style={[
                  styles.statusPillText,
                  isFiled && styles.statusPillTextMuted,
                  isRejected && styles.statusPillTextRejected,
                ]}
              >
                {STATUS_LABELS[entry.status]}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </View>

        <Text style={styles.submittedOn}>
          {isFiled ? 'Filed' : 'Submitted'} {formatDate(entry.submittedAt)}
        </Text>

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
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryLabel}>Total income</Text>
                <Text style={styles.summaryValue}>{formatNaira(entry.totalIncomeKobo)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryColumn}>
                <Text style={styles.summaryLabel}>Total deductions</Text>
                <Text style={styles.summaryValue}>{formatNaira(deductionsTotalKobo(entry))}</Text>
              </View>
            </View>
            <View style={styles.pendingNote}>
              <Ionicons
                name={isRejected ? 'alert-circle-outline' : 'time-outline'}
                size={14}
                color={isRejected ? colors.danger : colors.textSecondary}
              />
              <Text style={styles.pendingNoteText}>{PENDING_NOTES[entry.status]}</Text>
            </View>
          </>
        )}

        <Toast
          visible={showReceiptToast}
          message="Downloading a receipt isn't available in this preview yet."
          onHide={() => setShowReceiptToast(false)}
        />
      </Card>
    </Pressable>
  );
}

function HistoryState() {
  const { filingHistory, hasFiledCurrentYear } = useFiling();
  const { start, isStarting, error, clearError } = useStartFiling();

  return (
    <>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Filing History</Text>
        <Text style={styles.subtitle}>Filed and confirmed by FIRS</Text>
        {filingHistory.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </ScrollView>
      {!hasFiledCurrentYear ? (
        <Button
          label={`Start ${currentTaxYear()} filing`}
          variant="dark"
          onPress={start}
          loading={isStarting}
          style={styles.continueFilingButton}
        />
      ) : null}
      <Toast key={error ?? 'none'} visible={error !== null} message={error ?? ''} onHide={clearError} />
    </>
  );
}

export default function FilingHistoryScreen() {
  const { isLoading, loadError, reload, draft, filingHistory } = useFiling();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  let content;
  if (isLoading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (draft) {
    content = <InProgressState draft={draft} />;
  } else if (filingHistory.length > 0) {
    content = <HistoryState />;
  } else if (loadError) {
    content = (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Couldn&apos;t load your filings</Text>
        <Text style={styles.emptyBody}>{loadError}</Text>
        <Button label="Try again" variant="secondary" onPress={reload} style={styles.emptyButton} />
      </View>
    );
  } else {
    content = <NotStartedState />;
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>{content}</View>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // --- Not-started state ---
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    fontFamily: typography.display.fontFamily,
    fontWeight: '400',
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
  },

  // --- In-progress state ---
  inProgressContent: {
    paddingBottom: spacing.lg,
  },
  stepsComplete: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.success,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  stepsCard: {
    backgroundColor: colors.warningLight,
    borderWidth: 0,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  stepLabelPending: {
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.display,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neededDocCardWrap: {
    marginBottom: spacing.sm,
  },
  statusPillTextRejected: {
    color: colors.danger,
  },
  neededDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  neededDocLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  neededDocLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  howToText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  uploadLink: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  continueFilingButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },

  // --- History state ---
  listContent: {
    paddingBottom: spacing.lg,
  },
  filingCard: {
    marginTop: spacing.md,
  },
  filingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  filingCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  submittedOn: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  filedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  amountPaid: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  downloadReceiptRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  downloadReceiptText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
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
});
