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
 * it came from: 'manual' (typed) or 'ai' — an amount the server suggested
 * from the uploaded statement (ai_suggested_kobo, next task) that the user
 * accepted unchanged. A suggestion is pre-filled with a note to check it;
 * editing it makes it 'manual'.
 *
 * The flagged transaction is still the frame's mock example (12 Mar,
 * ₦350,000), shown only when a Nigerian bank was selected (flagged items
 * conceptually come from parsing an auto-pulled bank statement).
 *
 * ⚠️ No Figma design for the amount fields, the expenses field, the
 * confirmation checkbox, the AI-suggestion note or the validation errors —
 * built from the existing TextField, checkbox (Select Bank) and caption
 * styles.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  RequireDraft,
  SaveErrorNote,
  useFixMode,
  useSaveAndContinue,
} from '../../components/filing/FilingFlow';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { colors } from '../../constants/colors';
import { isNigerianBank } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { checkAmount, formatNaira, formatNairaInput, koboToInput, parseNairaInput } from '../../lib/money';
import { useFiling } from '../../state/filingContext';

const CATEGORY_OPTIONS = ['Salary', 'Business', 'Investment', 'Other'];

type FlaggedTransaction = {
  id: string;
  date: string;
  /** Whole kobo. */
  amount: number;
  category: string | null;
};

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
  } = useFiling();
  // Opened from Return Review's "Fix": highlight the source missing its
  // amount (focus), or the confirmation (no focus).
  const { isFixing, focus } = useFixMode();
  const { isSaving, error: saveError, saveAndContinue } = useSaveAndContinue(
    'deductions',
    '/(app)/deductions'
  );

  const savedSource = (platform: string) => incomeSources.find((s) => s.label === platform);

  // What's typed in each field. A platform with no amount yet but an AI
  // suggestion starts with the suggestion.
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      selectedPlatforms.map((platform) => {
        const saved = savedSource(platform);
        return [platform, koboToInput(saved?.amountKobo ?? saved?.aiSuggestedKobo ?? null)];
      })
    )
  );
  // Platforms whose field still holds the AI suggestion, unedited.
  const [aiPrefilled, setAiPrefilled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      selectedPlatforms.map((platform) => {
        const saved = savedSource(platform);
        const fromAi =
          saved?.aiSuggestedKobo != null &&
          (saved.amountKobo === null || (saved.amountSource === 'ai' && saved.amountKobo === saved.aiSuggestedKobo));
        return [platform, fromAi];
      })
    )
  );
  const [expensesInput, setExpensesInput] = useState(() =>
    businessExpensesKobo ? koboToInput(businessExpensesKobo) : ''
  );
  const [confirmed, setConfirmed] = useState(() => !!draft?.incomeConfirmedAt);
  const [amountErrors, setAmountErrors] = useState<Record<string, string>>({});
  const [expensesError, setExpensesError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const [flaggedTransactions, setFlaggedTransactions] = useState<FlaggedTransaction[]>([]);
  const [flaggedInitialized, setFlaggedInitialized] = useState(false);
  const hasFlaggedTransactions = flaggedTransactions.length > 0;
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);

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

  // Same "wait for real data, then decide once" approach as above — a lazy
  // useState initializer would have frozen this at whatever
  // selectedPlatforms was when the screen component was first constructed,
  // which can predate the user's actual selection (React Navigation may
  // construct a screen before it's focused).
  useEffect(() => {
    if (flaggedInitialized || selectedPlatforms.length === 0) {
      return;
    }
    setFlaggedInitialized(true);
    if (selectedPlatforms.some(isNigerianBank)) {
      setFlaggedTransactions([
        { id: 'flagged-1', date: `12 Mar ${taxYear}`, amount: 35000000, category: null },
      ]);
    }
  }, [selectedPlatforms, flaggedInitialized]);

  const allCategorized = flaggedTransactions.every((t) => t.category !== null);
  const completeButtonLabel = hasFlaggedTransactions ? 'Complete transaction review' : 'Continue';

  const handleSelectCategory = (transactionId: string, category: string) => {
    setFlaggedTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, category } : t))
    );
  };

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

        {hasFlaggedTransactions ? (
          <>
            <View style={styles.flaggedHeaderRow}>
              <Text style={styles.sectionTitle}>Flagged Transactions</Text>
              <View style={styles.needsReviewBadge}>
                <Text style={styles.needsReviewBadgeText}>Needs your review</Text>
              </View>
            </View>
            <Text style={styles.flaggedDescription}>
              We couldn&apos;t automatically determine the purpose of these transactions. Select
              the category that best describes each one.
            </Text>

            {flaggedTransactions.map((transaction) => (
              <Card key={transaction.id} style={styles.flaggedCard}>
                <View style={styles.flaggedTopRow}>
                  <Text style={styles.flaggedDate}>{transaction.date}</Text>
                  <Text style={styles.flaggedAmount}>{formatNaira(transaction.amount)}</Text>
                </View>
                <Text style={styles.flaggedPrompt}>What&apos;s this transaction for?</Text>
                <View style={styles.categoryRow}>
                  {CATEGORY_OPTIONS.map((category) => {
                    const isSelected = transaction.category === category;
                    return (
                      <Pressable
                        key={category}
                        onPress={() => handleSelectCategory(transaction.id, category)}
                        style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                        >
                          {category}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ))}
          </>
        ) : null}
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
