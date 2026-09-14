/**
 * Filing History — the screen behind the bottom nav's "File" tab.
 *
 * Three states, driven by FilingContext's `filingStatus` and
 * `filingHistory` (per the user's own designs, replacing the earlier
 * Claude-Design placeholder for the 2 states that had none before):
 *  - not-started (filingStatus === 'not-started' && filingHistory is
 *    empty): the design tool's own layout/copy, kept as-is except its
 *    button — that mockup used a color that doesn't match any real token
 *    here, so this uses the "dark" Button variant instead (colors.
 *    backgroundInverse), the same one Home already uses for the identical
 *    "start a filing" action.
 *  - in-progress (filingStatus === 'in-progress'): a resume screen — a
 *    5-step checklist and a list of documents still needed, both computed
 *    live from FilingContext rather than the fixed "3 of 5" example in the
 *    design. One deliberate deviation from that design: it also lists a
 *    still-needed bank statement, but Upload Documents (upload-
 *    documents.tsx) already treats a selected bank as auto-covered with no
 *    upload required — showing "needed" here would contradict a rule this
 *    app already enforces elsewhere, so "documents still needed" only
 *    lists deduction documents (which genuinely do gate progress, per
 *    deductions.tsx).
 *  - history (filingHistory has entries, and nothing's in progress): a
 *    list of past filings. Every real filing lands here as 'Submitted' —
 *    there's no backend to age one into a fully-processed 'Filed' return
 *    with a paid amount, so MOCK_PRIOR_FILING (⚠️ illustrative only, see
 *    filingContext.tsx) is appended to show what that eventually looks
 *    like.
 */
import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { DEDUCTION_DEFINITIONS, deductionDocumentKey } from '../../constants/deductions';
import { isNigerianBank } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import {
  CURRENT_TAX_YEAR,
  Deduction,
  FilingHistoryEntry,
  IncomeSource,
  MOCK_PRIOR_FILING,
  useFiling,
} from '../../state/filingContext';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function capitalize(text: string) {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

// Where "Continue filing" should send the user back to, based on how far
// their in-progress filing already got — best-effort, not a precise replay
// of every screen's own gating logic.
function getResumeRoute(filing: {
  selectedPlatforms: string[];
  uploadedDocuments: string[];
  incomeSources: IncomeSource[];
  deductions: Deduction[];
}): Href {
  if (filing.selectedPlatforms.length === 0) {
    return '/(app)/select-platform';
  }
  const manualPlatforms = filing.selectedPlatforms.filter((p) => !isNigerianBank(p));
  if (!manualPlatforms.every((p) => filing.uploadedDocuments.includes(p))) {
    return '/(app)/upload-documents';
  }
  if (filing.incomeSources.length === 0) {
    return '/(app)/income-summary';
  }
  const hasMissingDeductionDoc = filing.deductions.some(
    (d) => !filing.uploadedDocuments.includes(deductionDocumentKey(d.id))
  );
  if (hasMissingDeductionDoc) {
    return '/(app)/deductions';
  }
  return '/(app)/return-review';
}

function NotStartedState() {
  const goToFiling = () => router.push('/(app)/select-platform');
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name="file-plus-outline" size={36} color={colors.textPrimary} />
      </View>
      <Text style={styles.emptyTitle}>You haven&apos;t filed for {CURRENT_TAX_YEAR} yet</Text>
      <Text style={styles.emptyBody}>
        The deadline passed on 31 March 2026. Filing now limits what you owe.
      </Text>
      {/* "dark" variant — see file header on why this differs from the
          design tool's own button color. */}
      <Button label="File now" variant="dark" onPress={goToFiling} style={styles.emptyButton} />
    </View>
  );
}

function InProgressState() {
  const {
    selectedPlatforms,
    uploadedDocuments,
    incomeSources,
    deductions,
    addUploadedDocument,
  } = useFiling();
  const [showHowToToast, setShowHowToToast] = useState(false);

  const manualPlatforms = selectedPlatforms.filter((p) => !isNigerianBank(p));
  const documentsUploadedComplete =
    selectedPlatforms.length > 0 && manualPlatforms.every((p) => uploadedDocuments.includes(p));

  const steps = [
    { id: 'income-source', label: 'Income source selected', complete: selectedPlatforms.length > 0 },
    { id: 'documents-uploaded', label: 'Documents uploaded', complete: documentsUploadedComplete },
    { id: 'income-confirmed', label: 'Income confirmed', complete: incomeSources.length > 0 },
    { id: 'deductions-added', label: 'Deductions & Reliefs added', complete: deductions.length > 0 },
    { id: 'return-submitted', label: 'Return reviewed & Submitted', complete: false },
  ];
  const completedCount = steps.filter((s) => s.complete).length;
  const percent = Math.round((completedCount / steps.length) * 100);

  const neededDocuments = deductions
    .filter((d) => !uploadedDocuments.includes(deductionDocumentKey(d.id)))
    .map((d) => {
      const definition = DEDUCTION_DEFINITIONS.find((x) => x.id === d.id);
      return {
        id: deductionDocumentKey(d.id),
        label: capitalize(definition?.documentLabel ?? d.label),
      };
    });

  const subtitle =
    neededDocuments.length > 0
      ? `You are ${percent}% through. ${neededDocuments.length} document${
          neededDocuments.length === 1 ? '' : 's'
        } still needed.`
      : `You are ${percent}% through.`;

  const handleContinue = () =>
    router.push(getResumeRoute({ selectedPlatforms, uploadedDocuments, incomeSources, deductions }));

  return (
    <>
      <ScrollView contentContainerStyle={styles.inProgressContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your {CURRENT_TAX_YEAR} return</Text>
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
            {neededDocuments.map((doc) => (
              <Card key={doc.id} style={styles.neededDocCard}>
                <View style={styles.neededDocLeft}>
                  <Text style={styles.neededDocLabel}>{doc.label}</Text>
                  <Pressable
                    onPress={() => setShowHowToToast(true)}
                    hitSlop={8}
                    style={styles.howToRow}
                    accessibilityRole="button"
                  >
                    <Text style={styles.howToText}>How to get this</Text>
                    <Ionicons name="open-outline" size={13} color={colors.primary} />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => addUploadedDocument(doc.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={styles.uploadLink}>Upload</Text>
                </Pressable>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      <Button
        label="Continue filing"
        variant="dark"
        onPress={handleContinue}
        style={styles.continueFilingButton}
      />

      <Toast
        visible={showHowToToast}
        message="Instructions for this document aren't available in this preview yet."
        onHide={() => setShowHowToToast(false)}
      />
    </>
  );
}

function HistoryCard({ entry }: { entry: FilingHistoryEntry }) {
  const [showReceiptToast, setShowReceiptToast] = useState(false);
  const isFiled = entry.status === 'Filed';

  return (
    <Card style={styles.filingCard}>
      <View style={styles.filingCardHeader}>
        <Text style={styles.taxYear}>{entry.taxYear} tax return</Text>
        <View style={[styles.statusPill, isFiled && styles.statusPillMuted]}>
          <Text style={[styles.statusPillText, isFiled && styles.statusPillTextMuted]}>
            {entry.status}
          </Text>
        </View>
      </View>

      {isFiled ? (
        <View style={styles.filedRow}>
          <Text style={styles.submittedOn}>Filed {formatDate(entry.submittedAt)}</Text>
          <Text style={styles.amountPaid}>{formatNaira(entry.amountPaid ?? 0)} paid</Text>
        </View>
      ) : (
        <Text style={styles.submittedOn}>Submitted {formatDate(entry.submittedAt)}</Text>
      )}

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
            <Text style={styles.pendingNoteText}>
              Awaiting review — we&apos;ll update this once there&apos;s news.
            </Text>
          </View>
        </>
      )}

      <Toast
        visible={showReceiptToast}
        message="Downloading a receipt isn't available in this preview yet."
        onHide={() => setShowReceiptToast(false)}
      />
    </Card>
  );
}

function HistoryState() {
  const { filingHistory } = useFiling();
  const entries = [...filingHistory, MOCK_PRIOR_FILING];
  const nextYear = parseInt(entries[0].taxYear, 10) + 1;

  const goToNextFiling = () => router.push('/(app)/select-platform');

  return (
    <>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Filing History</Text>
        <Text style={styles.subtitle}>Filed and confirmed by FIRS</Text>
        {entries.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} />
        ))}
      </ScrollView>
      <Button
        label={`Start ${nextYear} filing`}
        variant="dark"
        onPress={goToNextFiling}
        style={styles.continueFilingButton}
      />
    </>
  );
}

export default function FilingHistoryScreen() {
  const { filingStatus, filingHistory } = useFiling();

  let content;
  if (filingStatus === 'in-progress') {
    content = <InProgressState />;
  } else if (filingHistory.length > 0) {
    content = <HistoryState />;
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
  neededDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
