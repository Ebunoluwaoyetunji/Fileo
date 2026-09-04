/**
 * Income Summary — from the Figma frames: an income summary list, a
 * flagged-transactions review (each needs a category before continuing),
 * and a success bottom sheet once every flagged transaction is categorized.
 *
 * No transaction parsing exists, so income lines are mock: one per selected
 * platform/bank, all using the frame's own example amount (₦4,820,000).
 * The flagged transaction is likewise mock, matching the frame's example
 * (12 Mar 2025, ₦350,000) — but only appears when at least one Nigerian
 * bank was selected (flagged items conceptually come from parsing an
 * auto-pulled bank statement, not a manually-uploaded document the user
 * already labeled themselves). That also makes the zero-flagged-
 * transactions case reachable and testable: select only non-bank
 * platforms and this screen has nothing to flag.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { colors } from '../../constants/colors';
import { isNigerianBank } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

const MOCK_INCOME_AMOUNT = 4820000;
const CATEGORY_OPTIONS = ['Salary', 'Business', 'Investment', 'Other'];

type FlaggedTransaction = {
  id: string;
  date: string;
  amount: number;
  category: string | null;
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function IncomeSummaryScreen() {
  const { selectedPlatforms, incomeSources, setIncomeSources } = useFiling();

  const [flaggedTransactions, setFlaggedTransactions] = useState<FlaggedTransaction[]>([]);
  const [flaggedInitialized, setFlaggedInitialized] = useState(false);
  const hasFlaggedTransactions = flaggedTransactions.length > 0;
  const [showSuccessSheet, setShowSuccessSheet] = useState(false);

  // Populate mock income lines from whatever was selected upstream, once —
  // no real document parsing exists yet, so every source uses the same
  // illustrative amount the Figma frame itself shows.
  useEffect(() => {
    if (incomeSources.length === 0 && selectedPlatforms.length > 0) {
      setIncomeSources(
        selectedPlatforms.map((platform, index) => ({
          id: `income-${index}-${platform}`,
          label: platform,
          amount: MOCK_INCOME_AMOUNT,
        }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatforms]);

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
        { id: 'flagged-1', date: '12 Mar 2025', amount: 350000, category: null },
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
    if (!allCategorized) {
      return;
    }
    setShowSuccessSheet(true);
  };

  const handleContinueFromSheet = () => {
    setShowSuccessSheet(false);
    router.push('/(app)/deductions');
  };

  return (
    <Screen>
      <FilingProgressBar step={3} />
      <Text style={styles.title}>Review your income</Text>
      <Text style={styles.subtitle}>
        We&apos;ve organized your income and highlighted a few transactions that need your review
        before we continue.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Income Summary</Text>
        <Card style={styles.summaryCard}>
          {incomeSources.map((source) => (
            <View key={source.id} style={styles.summaryRow}>
              <PlatformIcon label={source.label} size={32} />
              <Text style={styles.summaryLabel}>{source.label}</Text>
              <Text style={styles.summaryValue}>{formatNaira(source.amount)}</Text>
            </View>
          ))}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.infoNoteText}>
              All amounts have been converted to naira using the CBN average exchange rate.
            </Text>
          </View>
        </Card>

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
          <Button label="Continue" onPress={handleContinueFromSheet} />
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
