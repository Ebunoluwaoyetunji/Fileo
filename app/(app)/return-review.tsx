/**
 * Review your tax return — from the 2 Figma frames (base view + the
 * "ready to submit" confirmation state). The second frame is the same
 * screen with a bottom sheet open over it (same wordmark-free header, same
 * cards visible behind it), not a separate route — built on the existing
 * BottomSheet component, same pattern as Income Summary's success sheet.
 *
 * IMPORTANT: there's no real tax calculation engine here. "Estimated tax
 * savings"/"Estimated tax due" use one flat, clearly-mock 15% rate against
 * deductions/taxable income — this is NOT how Nigerian personal income tax
 * actually works (it's progressive/bracketed in reality). 15% was picked
 * because it's the one rate implied by the Deductions frame itself: its
 * Rent card states "up to ₦500,000... Potential saving is up to ₦75,000",
 * and 75,000 / 500,000 = 15% exactly. Everything here is display logic
 * over whatever FilingContext already holds, not a real calculation, and
 * none of it is saved (tax calculation moves to the server next).
 *
 * "Yes, submit my return" calls the server's submit_filing, which checks
 * the draft is complete and returns the filing's reference. While it runs
 * the button shows a spinner; a failure (no connection, or a step the
 * server says is incomplete) shows under the buttons and can be retried.
 * ⚠️ No design for the submitting / submit-failed states.
 *
 * Before anything is submitted, the screen asks the server what's still
 * missing (the same rules submit_filing enforces) every time it's shown.
 * Anything missing is listed in plain English ("Paystack statement not
 * uploaded") with a "Fix" that opens the exact step with that item
 * highlighted; Continue there comes straight back here. "Approve and
 * submit" stays disabled, with a line saying why, until nothing is missing.
 * If the server still refuses on submit (e.g. something changed on another
 * device), its list is shown the same way.
 * ⚠️ No design for the missing-items card, the checking / couldn't-check
 * lines, or the disabled-submit explanation.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BackButton } from '../../components/ui/BackButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { openFix, RequireDraft, SaveErrorNote } from '../../components/filing/FilingFlow';
import { Screen } from '../../components/layout/Screen';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { describeMissingItem, getMissingItems, MissingItem } from '../../lib/filings';
import { MOCK_TAX_RATE, useFiling } from '../../state/filingContext';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function ReturnReviewScreen() {
  return (
    <RequireDraft>
      <ReturnReviewContent />
    </RequireDraft>
  );
}

function ReturnReviewContent() {
  const {
    totalIncome,
    totalDeductions,
    incomeSources,
    deductions,
    taxYear,
    submit,
    draft,
    refreshDraft,
  } = useFiling();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // What's still missing, straight from the server's rules.
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [checkState, setCheckState] = useState<'checking' | 'done' | 'failed'>('checking');
  const draftId = draft?.id;

  const checkCompleteness = useCallback(async () => {
    if (!draftId) {
      return;
    }
    setCheckState('checking');
    // Everything is saved by the time you're here, so start from what the
    // server has (it may have changed on another device), and ask it what's
    // missing.
    const [result] = await Promise.all([getMissingItems(draftId), refreshDraft()]);
    if (result.error) {
      setCheckState('failed');
      return;
    }
    setMissingItems(result.items);
    setCheckState('done');
  }, [draftId, refreshDraft]);

  // Re-checked every time the screen is shown, e.g. after a Fix.
  useFocusEffect(
    useCallback(() => {
      checkCompleteness();
    }, [checkCompleteness])
  );

  const canSubmit = checkState === 'done' && missingItems.length === 0;
  const missingDetails = missingItems.map(describeMissingItem);
  const taxableIncome = Math.max(totalIncome - totalDeductions, 0);
  const estimatedTaxDue = Math.round(taxableIncome * MOCK_TAX_RATE);
  const estimatedTaxSavings = Math.round(totalDeductions * MOCK_TAX_RATE);

  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [calcExpanded, setCalcExpanded] = useState(false);
  const [showSubmitSheet, setShowSubmitSheet] = useState(false);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await submit();
    setIsSubmitting(false);
    if (result.error) {
      if (result.error.code === 'not_draft') {
        setShowSubmitSheet(false);
        router.replace('/(app)/filing-history');
        return;
      }
      if (result.error.code === 'incomplete') {
        // The server's own list, shown the same way as the pre-check.
        setMissingItems(result.error.missingItems ?? []);
        setCheckState('done');
        setShowSubmitSheet(false);
        refreshDraft();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      setSubmitError(
        result.error.code === 'network'
          ? 'Couldn’t submit. Check your connection and try again.'
          : result.error.message
      );
      return;
    }
    setShowSubmitSheet(false);
    router.replace({
      pathname: '/(app)/confirmation',
      params: { reference: result.reference, submittedAt: result.submittedAt },
    });
  };

  return (
    <Screen>
      <BackButton />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Review your tax return</Text>
        <Text style={styles.subtitle}>
          Take a moment to review your tax return before submitting it. You can still make
          changes if needed.
        </Text>

        {checkState === 'done' && missingDetails.length > 0 ? (
          <Card style={styles.missingCard}>
            <Text style={styles.missingTitle}>Finish these before you submit</Text>
            {missingDetails.map((item) => (
              <View key={item.id} style={styles.missingRow}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.missingLabel}>{item.label}</Text>
                <Pressable
                  onPress={() => openFix(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Fix: ${item.label}`}
                >
                  <Text style={styles.fixLink}>Fix</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Ionicons name="download-outline" size={18} color={colors.success} />
              <Text style={styles.statLabel}>Estimated tax savings</Text>
              <Text style={styles.statValueSavings}>{formatNaira(estimatedTaxSavings)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Ionicons name="wallet-outline" size={18} color={colors.textInverse} />
              <Text style={styles.statLabel}>Estimated tax due</Text>
              <Text style={styles.statValueDue}>{formatNaira(estimatedTaxDue)}</Text>
            </View>
          </View>
          <View style={styles.statsFooter}>
            <Text style={styles.statsFooterText}>Based on the information you&apos;ve provided.</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setIncomeExpanded((prev) => !prev)}
          accessibilityRole="button"
          testID="income-summary-toggle"
        >
          <Card style={styles.expandableRow}>
            <Text style={styles.expandableLabel}>Income Summary</Text>
            <View style={styles.expandableRight}>
              <Text style={styles.expandableValue}>{formatNaira(totalIncome)}</Text>
              <Ionicons
                name={incomeExpanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.textSecondary}
              />
            </View>
          </Card>
        </Pressable>
        {incomeExpanded ? (
          <Card style={styles.detailCard}>
            {incomeSources.length === 0 ? (
              <Text style={styles.detailEmpty}>No income sources recorded.</Text>
            ) : (
              incomeSources.map((source) => (
                <View key={source.id} style={styles.detailRow}>
                  <PlatformIcon label={source.label} size={28} />
                  <Text style={styles.detailRowLabel}>{source.label}</Text>
                  <Text style={styles.detailRowValue}>{formatNaira(source.amount)}</Text>
                </View>
              ))
            )}
          </Card>
        ) : null}

        <Pressable
          onPress={() => setCalcExpanded((prev) => !prev)}
          accessibilityRole="button"
          testID="tax-calculation-toggle"
        >
          <Card style={styles.expandableRow}>
            <Text style={styles.expandableLabel}>Tax calculation</Text>
            <Ionicons
              name={calcExpanded ? 'chevron-down' : 'chevron-forward'}
              size={18}
              color={colors.textSecondary}
            />
          </Card>
        </Pressable>
        {calcExpanded ? (
          <Card style={styles.detailCard}>
            <View style={styles.calcRow}>
              <Text style={styles.detailRowLabel}>Total income</Text>
              <Text style={styles.detailRowValue}>{formatNaira(totalIncome)}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.detailRowLabel}>Total deductions</Text>
              <Text style={styles.detailRowValue}>{formatNaira(totalDeductions)}</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowStrong]}>
              <Text style={styles.detailRowLabelStrong}>Taxable income</Text>
              <Text style={styles.detailRowValueStrong}>{formatNaira(taxableIncome)}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.detailRowLabel}>Estimated tax rate</Text>
              <Text style={styles.detailRowValue}>{Math.round(MOCK_TAX_RATE * 100)}%</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowStrong]}>
              <Text style={styles.detailRowLabelStrong}>Estimated tax due</Text>
              <Text style={styles.detailRowValueStrong}>{formatNaira(estimatedTaxDue)}</Text>
            </View>
            {deductions.length > 0 ? (
              <View style={styles.deductionsBreakdown}>
                {deductions.map((d) => (
                  <View key={d.id} style={styles.calcRow}>
                    <Text style={styles.detailRowLabel}>{d.label}</Text>
                    <Text style={styles.detailRowValue}>{formatNaira(d.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.filingInfoCard}>
          <Text style={styles.filingInfoTitle}>Filing Information</Text>
          <View style={styles.filingInfoRow}>
            <View>
              <Text style={styles.filingInfoLabel}>Tax year</Text>
              <Text style={styles.filingInfoValue}>{taxYear}</Text>
            </View>
            <View>
              <Text style={styles.filingInfoLabel}>State</Text>
              <Text style={styles.filingInfoValue}>Lagos State</Text>
            </View>
            <View style={styles.filingInfoLast}>
              <Text style={styles.filingInfoLabel}>Prepared by</Text>
              <Text style={styles.filingInfoValue}>Fileo Tax Professional</Text>
            </View>
          </View>
        </Card>

        <View style={styles.confirmNote}>
          <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.confirmNoteText}>
            By submitting, you confirm that the information provided is accurate to the best of
            your knowledge.
          </Text>
        </View>

        <Button
          label="Approve and submit"
          variant="dark"
          onPress={() => setShowSubmitSheet(true)}
          disabled={!canSubmit}
          style={styles.approveButton}
        />
        {checkState === 'checking' ? (
          <View style={styles.submitNoteRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.submitNote}>Checking your return…</Text>
          </View>
        ) : checkState === 'failed' ? (
          <View style={styles.submitNoteRow}>
            <Text style={styles.submitNote}>
              Couldn&apos;t check your return. Check your connection.
            </Text>
            <Pressable onPress={checkCompleteness} hitSlop={8} accessibilityRole="button">
              <Text style={styles.fixLink}>Try again</Text>
            </Pressable>
          </View>
        ) : missingDetails.length > 0 ? (
          <Text style={[styles.submitNote, styles.submitNoteCentered]}>
            Finish the {missingDetails.length === 1 ? 'item' : `${missingDetails.length} items`} at
            the top before you submit.
          </Text>
        ) : null}
        <Button
          label="I want to make a change"
          variant="ghost"
          onPress={() => router.back()}
        />
      </ScrollView>

      <BottomSheet visible={showSubmitSheet} onClose={() => setShowSubmitSheet(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Ready to submit your return?</Text>
          <Text style={styles.sheetBody}>
            Once you submit it, you won&apos;t be able to make changes through Fileo. Please
            review your information before you continue.
          </Text>

          <View style={styles.submittingToRow}>
            <Text style={styles.submittingToLabel}>Submitting to:</Text>
            <View style={styles.submittingToBadge}>
              <PlatformIcon label="FIRS" size={28} />
              <Text style={styles.submittingToName}>Federal Inland Revenue Service (FIRS)</Text>
            </View>
          </View>

          <Button
            label="Yes, submit my return"
            variant="dark"
            onPress={handleSubmit}
            loading={isSubmitting}
          />
          <Button
            label="Not yet — let me review again"
            variant="ghost"
            onPress={() => setShowSubmitSheet(false)}
            style={styles.sheetSecondaryButton}
          />
          <SaveErrorNote message={submitError} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  statsCard: {
    backgroundColor: colors.backgroundInverse,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  statColumn: {
    flex: 1,
    gap: spacing.xs,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  statValueSavings: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: colors.success,
  },
  statValueDue: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: colors.textInverse,
  },
  statsFooter: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: spacing.sm,
  },
  statsFooterText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  expandableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningLight,
    borderWidth: 0,
    marginBottom: spacing.sm,
  },
  expandableLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  expandableRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  expandableValue: {
    ...typography.bodyStrong,
    color: colors.success,
  },
  detailCard: {
    marginBottom: spacing.sm,
    marginTop: -spacing.xs,
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
  detailRowLabelStrong: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
  },
  detailRowValueStrong: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calcRowStrong: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  deductionsBreakdown: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  filingInfoCard: {
    marginBottom: spacing.md,
  },
  filingInfoTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  filingInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filingInfoLast: {
    alignItems: 'flex-end',
  },
  filingInfoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  filingInfoValue: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.textPrimary,
  },
  confirmNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
  confirmNoteText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
  approveButton: {
    marginBottom: spacing.sm,
  },
  missingCard: {
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  missingTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missingLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  fixLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  submitNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  submitNote: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  submitNoteCentered: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  sheetContent: {
    width: '100%',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  submittingToRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  submittingToLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  submittingToBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submittingToName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
  },
  sheetSecondaryButton: {
    marginTop: spacing.sm,
  },
});
