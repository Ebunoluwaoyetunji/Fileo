import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function DeductionsScreen() {
  const { deductions, setDeductions, totalDeductions } = useFiling();

  const handleAddDeduction = () => {
    // Placeholder until deduction rules are wired up.
    setDeductions([
      ...deductions,
      { id: `deduction-${deductions.length + 1}`, label: 'Pension contribution', amount: 20000 },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>Deductions & reliefs</Text>
      <Text style={styles.subtitle}>Add anything that reduces your taxable income.</Text>

      {deductions.map((deduction) => (
        <Card key={deduction.id} style={styles.row}>
          <Text style={styles.rowLabel}>{deduction.label}</Text>
          <Text style={styles.rowValue}>{formatNaira(deduction.amount)}</Text>
        </Card>
      ))}

      <Button label="Add Deduction" variant="secondary" onPress={handleAddDeduction} />

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total deductions</Text>
        <Text style={styles.totalValue}>{formatNaira(totalDeductions)}</Text>
      </Card>

      <Button
        label="Continue"
        onPress={() => router.push('/(app)/return-review')}
        style={styles.continueButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  rowValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    marginTop: spacing.lg,
  },
  totalLabel: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primaryDark,
  },
  continueButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
});
