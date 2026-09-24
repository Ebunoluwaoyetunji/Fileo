/**
 * Review your tax return — from the 2 Figma frames (base view + the
 * "ready to submit" confirmation state). The second frame is the same
 * screen with a bottom sheet open over it (same wordmark-free header, same
 * cards visible behind it), not a separate route — built on the existing
 * BottomSheet component, same pattern as Income Summary's success sheet.
 *
 * The tax figures are the server's (filing_tax_calculations, worked out
 * from the saved income and deductions under that tax year's rules and
 * recalculated on every save) — the app only displays them. A simple
 * breakdown (income → reliefs → taxable income → tax due) is always shown;
 * "Tax calculation" opens the detail: every relief (including any claimed
 * but not applied, with the reason), tax per band, and the minimum-tax
 * check. ⚠️ No design for the breakdown card or the calculation detail.
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
import { RELIEF_LABELS, TaxBand, taxSavedKobo } from '../../lib/filings';
import { formatNaira } from '../../lib/money';
import { useFiling } from '../../state/filingContext';

function bandLabel(band: TaxBand, index: number) {
  const rate = `${band.rateBp / 100}%`;
  if (band.widthKobo === null) {
    return `Above ${formatNaira(band.fromKobo)} at ${rate}`;
  }
  return `${index === 0 ? 'First' : 'Next'} ${formatNaira(band.widthKobo)} at ${rate}`;
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
    totalIncomeKobo,
    incomeSources,
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
  // The server's calculation for this draft (display only).
  const calc = draft?.taxCalculation ?? null;

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
              <Text style={styles.statValueSavings}>{calc ? formatNaira(taxSavedKobo(calc)) : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Ionicons name="wallet-outline" size={18} color={colors.textInverse} />
              <Text style={styles.statLabel}>Estimated tax due</Text>
              <Text style={styles.statValueDue}>{calc ? formatNaira(calc.taxDueKobo) : '—'}</Text>
            </View>
          </View>
          <View style={styles.statsFooter}>
            <Text style={styles.statsFooterText}>
              {calc
                ? 'Based on the information you’ve provided.'
                : 'We’ll work out your tax once your income is entered.'}
            </Text>
          </View>
        </View>

        {calc ? (
          <Card style={styles.breakdownCard}>
            <View style={styles.calcRow}>
              <Text style={styles.detailRowLabel}>Income</Text>
              <Text style={styles.detailRowValue}>{formatNaira(calc.incomeAfterExpensesKobo)}</Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={styles.detailRowLabel}>Reliefs and deductions</Text>
              <Text style={styles.detailRowValue}>− {formatNaira(calc.totalReliefsKobo)}</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowStrong]}>
              <Text style={styles.detailRowLabelStrong}>Taxable income</Text>
              <Text style={styles.detailRowValueStrong}>{formatNaira(calc.taxableIncomeKobo)}</Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowStrong]}>
              <Text style={styles.detailRowLabelStrong}>Tax due</Text>
              <Text style={styles.detailRowValueStrong}>{formatNaira(calc.taxDueKobo)}</Text>
            </View>
          </Card>
        ) : null}

        <Pressable
          onPress={() => setIncomeExpanded((prev) => !prev)}
          accessibilityRole="button"
          testID="income-summary-toggle"
        >
          <Card style={styles.expandableRow}>
            <Text style={styles.expandableLabel}>Income Summary</Text>
            <View style={styles.expandableRight}>
              <Text style={styles.expandableValue}>{formatNaira(totalIncomeKobo)}</Text>
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
                  <Text style={styles.detailRowValue}>
                    {source.amountKobo === null ? '—' : formatNaira(source.amountKobo)}
                  </Text>
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
            {!calc ? (
              <Text style={styles.detailEmpty}>
                We&apos;ll work out your tax once your income is entered.
              </Text>
            ) : (
              <>
                <View style={styles.calcRow}>
                  <Text style={styles.detailRowLabel}>Total income</Text>
                  <Text style={styles.detailRowValue}>{formatNaira(calc.grossIncomeKobo)}</Text>
                </View>
                {calc.businessExpensesKobo > 0 ? (
                  <View style={styles.calcRow}>
                    <Text style={styles.detailRowLabel}>Business expenses</Text>
                    <Text style={styles.detailRowValue}>− {formatNaira(calc.businessExpensesKobo)}</Text>
                  </View>
                ) : null}
                <View style={[styles.calcRow, styles.calcRowStrong]}>
                  <Text style={styles.detailRowLabelStrong}>Income after expenses</Text>
                  <Text style={styles.detailRowValueStrong}>
                    {formatNaira(calc.incomeAfterExpensesKobo)}
                  </Text>
                </View>

                <Text style={styles.calcSection}>Reliefs and deductions</Text>
                {calc.reliefs.map((relief) => (
                  <View key={relief.code} style={styles.reliefBlock}>
                    <View style={styles.calcRow}>
                      <Text style={styles.detailRowLabel}>{RELIEF_LABELS[relief.code] ?? relief.code}</Text>
                      <Text
                        style={[
                          styles.detailRowValue,
                          relief.status === 'not_applied' && styles.notAppliedValue,
                        ]}
                      >
                        {relief.status === 'not_applied'
                          ? 'Not applied'
                          : `− ${formatNaira(relief.appliedKobo)}`}
                      </Text>
                    </View>
                    {relief.status === 'not_applied' && relief.note ? (
                      <Text style={styles.reliefNote}>{relief.note}</Text>
                    ) : relief.claimedKobo !== null && relief.claimedKobo !== relief.appliedKobo ? (
                      <Text style={styles.reliefNote}>
                        {relief.note ? `${relief.note} ` : ''}You paid {formatNaira(relief.claimedKobo)}
                        {relief.status === 'capped' ? '; capped.' : '.'}
                      </Text>
                    ) : relief.code === 'cra' && relief.note ? (
                      <Text style={styles.reliefNote}>{relief.note}</Text>
                    ) : null}
                  </View>
                ))}
                <View style={[styles.calcRow, styles.calcRowStrong]}>
                  <Text style={styles.detailRowLabelStrong}>Taxable income</Text>
                  <Text style={styles.detailRowValueStrong}>{formatNaira(calc.taxableIncomeKobo)}</Text>
                </View>

                <Text style={styles.calcSection}>Tax by band</Text>
                {calc.bands
                  .filter((band) => band.taxableKobo > 0)
                  .map((band) => (
                    <View key={band.fromKobo} style={styles.calcRow}>
                      <Text style={styles.detailRowLabel}>
                        {bandLabel(band, calc.bands.indexOf(band))}
                      </Text>
                      <Text style={styles.detailRowValue}>{formatNaira(band.taxKobo)}</Text>
                    </View>
                  ))}
                {calc.taxableIncomeKobo === 0 ? (
                  <Text style={styles.reliefNote}>No taxable income, so no tax from the bands.</Text>
                ) : null}
                {calc.minimumTaxKobo !== null ? (
                  <View style={styles.reliefBlock}>
                    <View style={styles.calcRow}>
                      <Text style={styles.detailRowLabel}>Minimum tax (1% of gross income)</Text>
                      <Text style={styles.detailRowValue}>{formatNaira(calc.minimumTaxKobo)}</Text>
                    </View>
                    <Text style={styles.reliefNote}>
                      {calc.minimumTaxApplied
                        ? 'Your tax from the bands is lower than the minimum tax, so the minimum tax applies.'
                        : 'Your tax from the bands is higher, so the minimum tax doesn’t apply.'}
                    </Text>
                  </View>
                ) : null}
                <View style={[styles.calcRow, styles.calcRowStrong]}>
                  <Text style={styles.detailRowLabelStrong}>Tax due</Text>
                  <Text style={styles.detailRowValueStrong}>{formatNaira(calc.taxDueKobo)}</Text>
                </View>
                <Text style={styles.rulesNote}>
                  {calc.rulesName ?? calc.rulesVersion} ({calc.rulesVersion}). Amounts are rounded to
                  the nearest kobo at each step.
                </Text>
              </>
            )}
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
  breakdownCard: {
    marginBottom: spacing.md,
  },
  calcSection: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  reliefBlock: {
    marginBottom: spacing.xs,
  },
  reliefNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notAppliedValue: {
    color: colors.textSecondary,
  },
  rulesNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
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
