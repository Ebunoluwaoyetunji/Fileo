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

export default function ReturnReviewScreen() {
  const { totalIncome, totalDeductions } = useFiling();
  const taxableIncome = Math.max(totalIncome - totalDeductions, 0);

  return (
    <Screen>
      <Text style={styles.title}>Review your return</Text>
      <Text style={styles.subtitle}>Make sure everything looks right before you submit.</Text>

      <Card style={styles.row}>
        <Text style={styles.rowLabel}>Total income</Text>
        <Text style={styles.rowValue}>{formatNaira(totalIncome)}</Text>
      </Card>
      <Card style={styles.row}>
        <Text style={styles.rowLabel}>Total deductions</Text>
        <Text style={styles.rowValue}>{formatNaira(totalDeductions)}</Text>
      </Card>
      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Taxable income</Text>
        <Text style={styles.totalValue}>{formatNaira(taxableIncome)}</Text>
      </Card>

      <Button
        label="Submit Return"
        onPress={() => router.push('/(app)/confirmation')}
        style={styles.submitButton}
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
  submitButton: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
