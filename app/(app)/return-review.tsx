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
 * over whatever FilingContext already holds, not a real calculation.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { Screen } from '../../components/layout/Screen';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

// Mock only — see file header.
const MOCK_TAX_RATE = 0.15;

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function ReturnReviewScreen() {
  const { totalIncome, totalDeductions, incomeSources, deductions } = useFiling();
  const taxableIncome = Math.max(totalIncome - totalDeductions, 0);
  const estimatedTaxDue = Math.round(taxableIncome * MOCK_TAX_RATE);
  const estimatedTaxSavings = Math.round(totalDeductions * MOCK_TAX_RATE);

  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [calcExpanded, setCalcExpanded] = useState(false);
  const [showSubmitSheet, setShowSubmitSheet] = useState(false);

  const handleSubmit = () => {
    setShowSubmitSheet(false);
    router.replace('/(app)/confirmation');
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Review your tax return</Text>
        <Text style={styles.subtitle}>
          Take a moment to review your tax return before submitting it. You can still make
          changes if needed.
        </Text>

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
              <Text style={styles.filingInfoValue}>2025</Text>
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
          style={styles.approveButton}
        />
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

          <Button label="Yes, submit my return" variant="dark" onPress={handleSubmit} />
          <Button
            label="Not yet — let me review again"
            variant="ghost"
            onPress={() => setShowSubmitSheet(false)}
            style={styles.sheetSecondaryButton}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
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
