/**
 * Income Summary — from the Figma frames: an income summary list, a
 * flagged-transactions review (each needs a category before continuing),
 * and a success bottom sheet once every flagged transaction is categorized.
 *
 * Income is real: each selected platform/bank has an amount field in naira
 * (commas added as you type; stored as whole kobo), plus one optional
 * "allowable business expenses" field. The user ticks "I confirm these
 * amounts…" before continuing; that confirmation is saved with the figures
 * and cleared by the server if they change later. Each amount records where
 * it came from: 'manual' (typed) or 'ai' — the income the server read from
 * the platform's uploaded statement (lib/extractions) that the user
 * accepted unchanged. A suggestion is pre-filled with a note to check it,
 * the period the statement covers and any warnings (part of the year, the
 * wrong year, a foreign currency — which is never converted, so nothing is
 * pre-filled); editing it makes it 'manual'. While a statement is still
 * being read the row says so and fills in when the result arrives. If it
 * couldn't be read, the row says why and the user types the amount.
 *
 * Under an amount read from a statement: any payouts left out because
 * they're already counted under another platform, and "See breakdown"
 * (statement-breakdown.tsx). A statement that was uploaded but never read
 * (the user chose "Enter manually") offers "Not sure of the amount? Let AI
 * read your statement", which asks for consent and reads it — no new
 * upload. A one-line tip explains what isn't income.
 *
 * Flagged transactions are the real ones the AI wasn't sure about: each
 * shows its date, amount and description, and the user answers Income or
 * not (own transfer, refund, loan, reversal, other). Answers are saved
 * straight away and the server recalculates the suggestion. They're only
 * asked for (and only block Continue) where the AI's amount is being used;
 * a platform with a typed ('manual') amount gets a one-line note instead.
 *
 * ⚠️ No Figma design for the amount fields, the expenses field, the
 * confirmation checkbox, the AI-suggestion note, the reading / warning /
 * failure lines, the flagged-transaction answers or the validation errors —
 * built from the existing TextField, checkbox (Select Bank), chip and
 * caption styles.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RequireDraft,
  SaveErrorNote,
  useAiConsentPrompt,
  useFixMode,
  useSaveAndContinue,
} from '../../components/filing/FilingFlow';
import { StatementReadingStatus } from '../../components/filing/StatementReadingStatus';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { checkAmount, formatNaira, formatNairaInput, koboToInput, parseNairaInput } from '../../lib/money';
import {
  DECISION_OPTIONS,
  Extraction,
  formatIsoDate,
  formatStatementAmount,
  isReading,
  TransactionDecision,
} from '../../lib/extractions';
import { useFiling } from '../../state/filingContext';

export default function IncomeSummaryScreen() {
  return (
    <RequireDraft>
      <IncomeSummaryContent />
    </RequireDraft>
  );
}

function IncomeSummaryContent() {
  const {
    draft,
    selectedPlatforms,
    incomeSources,
    setIncomeSources,
    businessExpensesKobo,
    setBusinessExpensesKobo,
    taxYear,
    documentIdsByKey,
    extractionsByDocumentId,
    decideFlagged,
    aiConsent,
    readStatement,
  } = useFiling();
  useAiConsentPrompt();
  // Opened from Return Review's "Fix": highlight the source missing its
  // amount (focus), or the confirmation (no focus).
  const { isFixing, focus } = useFixMode();
  const { isSaving, error: saveError, saveAndContinue } = useSaveAndContinue(
    'deductions',
    '/(app)/deductions'
  );

  const savedSource = (platform: string) => incomeSources.find((s) => s.label === platform);

  /** The read result for this platform's statement, if any. */
  const extractionFor = (platform: string): Extraction | undefined => {
    const documentId = documentIdsByKey[platform];
    return documentId ? extractionsByDocumentId[documentId] : undefined;
  };
  /** The server's suggested income for this platform, or null. Uses the
   * latest read result once loaded, else what was saved on the draft. */
  const suggestionFor = (platform: string): number | null => {
    const extraction = extractionFor(platform);
    if (extraction) {
      return extraction.status === 'done' ? extraction.suggestedIncomeKobo : null;
    }
    return savedSource(platform)?.aiSuggestedKobo ?? null;
  };
  /** Starts from the suggestion: nothing entered yet, or the suggestion was
   * accepted unchanged before ('ai'). A typed ('manual') amount is kept. */
  const usesSuggestion = (platform: string) => {
    const saved = savedSource(platform);
    return suggestionFor(platform) !== null && (saved?.amountKobo == null || saved.amountSource === 'ai');
  };

  // What's typed in each field.
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      selectedPlatforms.map((platform) => [
        platform,
        koboToInput(usesSuggestion(platform) ? suggestionFor(platform) : savedSource(platform)?.amountKobo ?? null),
      ])
    )
  );
  // Platforms whose field still holds the AI suggestion, unedited.
  const [aiPrefilled, setAiPrefilled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(selectedPlatforms.map((platform) => [platform, usesSuggestion(platform)]))
  );
  const [expensesInput, setExpensesInput] = useState(() =>
    businessExpensesKobo ? koboToInput(businessExpensesKobo) : ''
  );
  const [confirmed, setConfirmed] = useState(() => !!draft?.incomeConfirmedAt);
  const [amountErrors, setAmountErrors] = useState<Record<string, string>>({});
  const [expensesError, setExpensesError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const [showSuccessSheet, setShowSuccessSheet] = useState(false);
  const [decisionErrors, setDecisionErrors] = useState<Record<string, boolean>>({});

  // A suggestion that arrives (statement read) or changes (a flagged item
  // answered) fills the field — unless the user has typed their own amount.
  const suggestionKey = selectedPlatforms.map((p) => `${p}:${suggestionFor(p)}`).join('|');
  useEffect(() => {
    selectedPlatforms.forEach((platform) => {
      const suggestion = suggestionFor(platform);
      if (suggestion === null) {
        return;
      }
      const current = inputs[platform] ?? '';
      const untouched = current.trim() === '' || aiPrefilled[platform];
      const next = koboToInput(suggestion);
      if (untouched && next !== current) {
        setInputs((prev) => ({ ...prev, [platform]: next }));
        setAiPrefilled((prev) => ({ ...prev, [platform]: true }));
        setAmountErrors((prev) => ({ ...prev, [platform]: '' }));
        if (current.trim() !== '') {
          // The figure changed under the tick: confirm it again.
          setConfirmed(false);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionKey]);

  // Transactions the AI wasn't sure about, per platform statement. They
  // only need answers where the AI's amount is being used: once the user
  // types their own amount ('manual'), that platform's answers wouldn't
  // change anything, so they're not asked for (same rule as the server's
  // "what's missing" list).
  const isManualAmount = (platform: string) =>
    !aiPrefilled[platform] && (inputs[platform] ?? '').trim() !== '';
  const allFlaggedGroups = selectedPlatforms
    .map((platform) => ({
      platform,
      documentId: documentIdsByKey[platform],
      extraction: extractionFor(platform),
    }))
    .filter(
      (group): group is { platform: string; documentId: string; extraction: Extraction } =>
        !!group.documentId && group.extraction?.status === 'done' && group.extraction.flagged.length > 0
    );
  const flaggedGroups = allFlaggedGroups.filter((group) => !isManualAmount(group.platform));
  const skippedFlaggedPlatforms = allFlaggedGroups
    .filter((group) => isManualAmount(group.platform))
    .map((group) => group.platform);
  const hasFlaggedTransactions = flaggedGroups.length > 0;

  const handleDecision = async (documentId: string, transactionId: string, decision: TransactionDecision) => {
    setDecisionErrors((prev) => ({ ...prev, [transactionId]: false }));
    const { error } = await decideFlagged(documentId, transactionId, decision);
    if (error) {
      setDecisionErrors((prev) => ({ ...prev, [transactionId]: true }));
    }
  };

  // Keep the filing's working copy in step with the fields, so Continue
  // saves exactly what's on screen.
  useEffect(() => {
    setIncomeSources(
      selectedPlatforms.map((platform) => {
        const saved = savedSource(platform);
        const kobo = parseNairaInput(inputs[platform] ?? '');
        return {
          id: `income-${platform}`,
          label: platform,
          amountKobo: kobo,
          amountSource: kobo === null ? null : aiPrefilled[platform] ? 'ai' : 'manual',
          aiSuggestedKobo: saved?.aiSuggestedKobo ?? null,
        };
      })
    );
    setBusinessExpensesKobo(parseNairaInput(expensesInput) ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, aiPrefilled, expensesInput, selectedPlatforms]);

  const handleAmountChange = (platform: string, text: string) => {
    setInputs((prev) => ({ ...prev, [platform]: formatNairaInput(text) }));
    setAiPrefilled((prev) => ({ ...prev, [platform]: false }));
    setAmountErrors((prev) => ({ ...prev, [platform]: '' }));
    setConfirmed(false);
  };

  const handleExpensesChange = (text: string) => {
    setExpensesInput(formatNairaInput(text));
    setExpensesError(undefined);
    setConfirmed(false);
  };

  const totalKobo = selectedPlatforms.reduce(
    (sum, platform) => sum + (parseNairaInput(inputs[platform] ?? '') ?? 0),
    0
  );

  /** All fields valid and confirmed? Shows every error at once. */
  const validate = () => {
    const errors: Record<string, string> = {};
    let total = 0;
    selectedPlatforms.forEach((platform) => {
      const result = checkAmount(inputs[platform] ?? '', `Enter the income you received from ${platform}.`);
      if (result.error !== null) {
        errors[platform] = result.error;
      } else {
        total += result.kobo;
      }
    });
    let expenses: string | undefined;
    if (expensesInput.trim()) {
      const result = checkAmount(expensesInput, '');
      if (result.error !== null) {
        expenses = result.error;
      } else if (result.kobo > total) {
        expenses = 'Business expenses can’t be more than your total income.';
      }
    }
    const confirm = confirmed ? undefined : 'Tick the box to confirm your income is correct.';
    setAmountErrors(errors);
    setExpensesError(expenses);
    setConfirmError(confirm);
    return Object.keys(errors).length === 0 && !expenses && !confirm;
  };

  const allCategorized = flaggedGroups.every((group) =>
    group.extraction.flagged.every((t) => t.decision !== null)
  );
  const completeButtonLabel = hasFlaggedTransactions ? 'Complete transaction review' : 'Continue';

  const handleCompleteReview = () => {
    if (!allCategorized || !validate()) {
      return;
    }
    setShowSuccessSheet(true);
  };

  const handleContinueFromSheet = async () => {
    if (await saveAndContinue({ incomeConfirmed: true })) {
      setShowSuccessSheet(false);
    }
  };

  // Under each amount: payouts left out, "See breakdown" once a statement
  // has been read, or — if it hasn't been read and the field is empty —
  // an offer to let AI read the statement already uploaded.
  const renderStatementLinks = (platform: string) => {
    const documentId = documentIdsByKey[platform];
    if (!documentId) {
      return null;
    }
    const extraction = extractionFor(platform);
    if (extraction?.status === 'done') {
      return (
        <View style={styles.statementLinks}>
          {extraction.platformPayoutsKobo ? (
            <Text style={styles.payoutNote}>
              {formatStatementAmount(extraction.platformPayoutsKobo, extraction.currency)} of payouts
              left out: already counted in your other platforms.
            </Text>
          ) : null}
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(app)/statement-breakdown', params: { documentId, platform } })
            }
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`See breakdown for ${platform}`}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>See breakdown</Text>
          </Pressable>
        </View>
      );
    }
    if (!extraction && !isReading(extraction) && (inputs[platform] ?? '').trim() === '') {
      return (
        <Pressable
          onPress={() => {
            if (aiConsent === 'allowed') {
              readStatement(documentId);
            } else {
              // Allowing it starts reading every statement already uploaded.
              router.push('/(app)/ai-consent');
            }
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={[styles.statementLinks, styles.linkButton]}
        >
          <Text style={styles.linkText}>Not sure of the amount? Let AI read your statement</Text>
        </Pressable>
      );
    }
    return null;
  };

  return (
    <Screen>
      <BackButton />
      <FilingProgressBar step={3} />
      <Text style={styles.title}>Review your income</Text>
      <Text style={styles.subtitle}>
        Enter what you received from each platform in {taxYear}, in naira, then confirm the
        amounts.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.incomeTip}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.incomeTipText}>
            Money moved between your own accounts, loans, refunds and platform payouts aren’t
            income.
          </Text>
        </View>
        <Text style={styles.sectionTitle}>Income Summary</Text>
        <Card style={styles.summaryCard}>
          {selectedPlatforms.map((platform) => (
            <View
              key={platform}
              style={[styles.incomeRow, focus === platform && styles.summaryRowHighlighted]}
            >
              <View style={styles.summaryRow}>
                <PlatformIcon label={platform} size={32} />
                <Text style={styles.summaryLabel}>{platform}</Text>
              </View>
              <View style={styles.readingStatus}>
                <StatementReadingStatus documentId={documentIdsByKey[platform]} variant="full" />
              </View>
              {aiPrefilled[platform] ? (
                <Text style={styles.aiNote}>
                  Suggested from your statement. Check it before you confirm.
                </Text>
              ) : null}
              <TextField
                label={`Amount received in ${taxYear} (₦)`}
                placeholder="0"
                keyboardType="decimal-pad"
                value={inputs[platform] ?? ''}
                onChangeText={(text) => handleAmountChange(platform, text)}
                errorMessage={amountErrors[platform] || undefined}
                accessibilityLabel={`Income from ${platform} in naira`}
              />
              {renderStatementLinks(platform)}
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total income</Text>
            <Text style={styles.summaryValue}>{formatNaira(totalKobo)}</Text>
          </View>
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.infoNoteText}>
              Convert foreign earnings to naira using the CBN average exchange rate.
            </Text>
          </View>
        </Card>

        <TextField
          label="Allowable business expenses (₦), optional"
          placeholder="0"
          keyboardType="decimal-pad"
          value={expensesInput}
          onChangeText={handleExpensesChange}
          errorMessage={expensesError}
          accessibilityLabel="Allowable business expenses in naira"
        />
        <Text style={styles.expensesHelp}>
          Costs you paid only to earn this income, like data, equipment or platform fees. Leave
          blank if none.
        </Text>

        {skippedFlaggedPlatforms.length > 0 ? (
          <Text style={styles.flaggedSkipped}>
            You entered your own amount for {skippedFlaggedPlatforms.join(' and ')}, so you don’t
            need to review the transactions we flagged in{' '}
            {skippedFlaggedPlatforms.length === 1 ? 'that statement' : 'those statements'}.
          </Text>
        ) : null}

        {hasFlaggedTransactions ? (
          <>
            <View style={styles.flaggedHeaderRow}>
              <Text style={styles.sectionTitle}>Flagged Transactions</Text>
              <View style={styles.needsReviewBadge}>
                <Text style={styles.needsReviewBadgeText}>Needs your review</Text>
              </View>
            </View>
            <Text style={styles.flaggedDescription}>
              We couldn&apos;t tell whether these payments are income. Tell us what each one is;
              only income counts towards your tax.
            </Text>

            {flaggedGroups.map((group) => (
              <View key={group.platform}>
                {flaggedGroups.length > 1 || selectedPlatforms.length > 1 ? (
                  <Text style={styles.flaggedSource}>From your {group.platform} statement</Text>
                ) : null}
                {group.extraction.flagged.map((transaction) => (
                  <Card
                    key={transaction.id}
                    style={[
                      styles.flaggedCard,
                      isFixing &&
                        focus === group.platform &&
                        transaction.decision === null &&
                        styles.flaggedCardHighlighted,
                    ]}
                  >
                    <View style={styles.flaggedTopRow}>
                      <Text style={styles.flaggedDate}>{formatIsoDate(transaction.date)}</Text>
                      <Text style={styles.flaggedAmount}>
                        {formatStatementAmount(transaction.amountMinor, group.extraction.currency)}
                      </Text>
                    </View>
                    <Text style={styles.flaggedDescriptionText}>{transaction.description}</Text>
                    <Text style={styles.flaggedPrompt}>Is this income?</Text>
                    <View style={styles.categoryRow}>
                      {DECISION_OPTIONS.map((option) => {
                        const isSelected = transaction.decision === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => handleDecision(group.documentId, transaction.id, option.value)}
                            style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                            accessibilityRole="radio"
                            aria-checked={isSelected}
                          >
                            <Text
                              style={[
                                styles.categoryChipText,
                                isSelected && styles.categoryChipTextSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {decisionErrors[transaction.id] ? (
                      <Text style={styles.decisionError}>Couldn’t save your answer. Try again.</Text>
                    ) : null}
                  </Card>
                ))}
              </View>
            ))}
          </>
        ) : null}

        <Pressable
          onPress={() => {
            setConfirmed((prev) => !prev);
            setConfirmError(undefined);
          }}
          style={[
            styles.confirmRow,
            isFixing && !focus && !confirmed && styles.summaryRowHighlighted,
          ]}
          accessibilityRole="checkbox"
          aria-checked={confirmed}
        >
          <Ionicons
            name={confirmed ? 'checkbox' : 'square-outline'}
            size={22}
            color={confirmed ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.confirmText}>
            I confirm these amounts are correct and complete for {taxYear}.
          </Text>
        </Pressable>
        {confirmError ? <Text style={styles.confirmError}>{confirmError}</Text> : null}
      </ScrollView>

      <Button
        label={completeButtonLabel}
        disabled={!allCategorized}
        onPress={handleCompleteReview}
        style={styles.completeButton}
      />

      <BottomSheet visible={showSuccessSheet} onClose={() => setShowSuccessSheet(false)}>
        <View style={styles.sheetContent}>
          <Ionicons
            name="checkmark-circle-outline"
            size={64}
            color={colors.backgroundInverse}
            style={[styles.sheetIcon, styles.sheetIconCentered]}
          />
          <Text style={styles.sheetTitle}>All transactions reviewed</Text>
          <Text style={styles.sheetBody}>You can now continue with your tax return.</Text>
          <Button label="Continue" onPress={handleContinueFromSheet} loading={isSaving} />
          <SaveErrorNote message={saveError} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  incomeRow: {
    marginBottom: spacing.sm,
  },
  readingStatus: {
    marginBottom: spacing.xs,
  },
  flaggedSkipped: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  flaggedSource: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  flaggedCardHighlighted: {
    borderWidth: 2,
    borderColor: colors.warning,
  },
  flaggedDescriptionText: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  decisionError: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  aiNote: {
    ...typography.caption,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  expensesHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  confirmText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  confirmError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  summaryRowHighlighted: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.sm,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  summaryValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  incomeTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  incomeTipText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  statementLinks: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  payoutNote: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  linkButton: {
    alignSelf: 'flex-start',
  },
  linkText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  infoNoteText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
  flaggedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  needsReviewBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  needsReviewBadgeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  flaggedDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  flaggedCard: {
    backgroundColor: colors.warningLight,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  flaggedTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  flaggedDate: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  flaggedAmount: {
    ...typography.bodyStrong,
    color: colors.warning,
  },
  flaggedPrompt: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.background,
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  categoryChipTextSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  completeButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  sheetContent: {
    width: '100%',
  },
  sheetIcon: {
    marginBottom: spacing.md,
  },
  sheetIconCentered: {
    alignSelf: 'center',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
});
