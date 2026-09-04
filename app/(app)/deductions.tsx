/**
 * Deductions — from the Figma frame: an info card, then 4 toggleable
 * deduction categories (Rent, Life assurance, Pension, NHF), each with a
 * description of eligibility and what document it needs.
 *
 * The frame has no amount-entry fields — eligibility is toggle-only — so
 * each category's stored deduction amount is a mock computed figure, not
 * something the user typed in:
 *   - Rent: the frame's own stated cap, ₦500,000.
 *   - Pension: 8% of totalIncome (the frame's stated rate).
 *   - NHF: 2.5% of totalIncome (the frame's stated rate, using totalIncome
 *     as a stand-in for "monthly basic salary" — there's no separate salary
 *     figure collected anywhere in this flow).
 *   - Life assurance: the frame gives no rate or cap for this one ("full
 *     premium paid" isn't computable from anything already collected), so
 *     toggling it on contributes ₦0 until a real amount is captured
 *     somewhere — flagged to the user rather than inventing a figure.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

type DeductionDefinition = {
  id: string;
  label: string;
  description: string;
  computeAmount: (totalIncome: number) => number;
};

const DEDUCTION_DEFINITIONS: DeductionDefinition[] = [
  {
    id: 'rent',
    label: 'Rent payments',
    description:
      'If you paid rent in 2025, you can deduct up to ₦500,000 from your taxable income. Potential saving is up to ₦75,000 off your tax bill.',
    computeAmount: () => 500000,
  },
  {
    id: 'life-assurance',
    label: 'Life assurance premium',
    description:
      'Full premium paid on a life insurance policy. Document needed — insurance premium receipt from a registered insurer.',
    computeAmount: () => 0,
  },
  {
    id: 'pension',
    label: 'Pension contributions',
    description:
      'If you contributed up to 8% of your monthly gross income to a registered PFA. Document needed — annual PFA statement.',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.08),
  },
  {
    id: 'nhf',
    label: 'National Housing Fund (NHF)',
    description:
      '2.5% of monthly basic salary contributed to Federal Mortgage Bank. Document needed — NHF contribution statement.',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.025),
  },
];

export default function DeductionsScreen() {
  const { totalIncome, setDeductions } = useFiling();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});

  // Keep FilingContext in sync as the user toggles, so return-review sees
  // current data even if they navigate away without an explicit save step.
  useEffect(() => {
    const nextDeductions = DEDUCTION_DEFINITIONS.filter((d) => enabled[d.id]).map((d) => ({
      id: d.id,
      label: d.label,
      amount: d.computeAmount(totalIncome),
    }));
    setDeductions(nextDeductions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, totalIncome]);

  const toggleDeduction = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Let&apos;s reduce what you owe.</Text>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>You may qualify for tax deductions</Text>
          <Text style={styles.infoBody}>
            Answer a few questions to see if you&apos;re eligible. Every deduction you claim could
            help reduce your taxable income.
          </Text>
        </Card>

        {DEDUCTION_DEFINITIONS.map((deduction) => (
          <Card key={deduction.id} style={styles.deductionCard}>
            <View style={styles.deductionHeader}>
              <Text style={styles.deductionTitle}>{deduction.label}</Text>
              <Switch
                value={!!enabled[deduction.id]}
                onValueChange={() => toggleDeduction(deduction.id)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
            <Text style={styles.deductionDescription}>{deduction.description}</Text>
          </Card>
        ))}
      </ScrollView>

      <Button
        label="Continue"
        onPress={() => router.push('/(app)/return-review')}
        style={styles.continueButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.warningLight,
    borderWidth: 0,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  deductionCard: {
    marginBottom: spacing.sm,
  },
  deductionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  deductionTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  deductionDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  continueButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
