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

export default function IncomeSummaryScreen() {
  const { incomeSources, setIncomeSources, totalIncome } = useFiling();

  const handleAddIncome = () => {
    // Placeholder until income is parsed from uploaded documents.
    setIncomeSources([
      ...incomeSources,
      { id: `income-${incomeSources.length + 1}`, label: 'Freelance income', amount: 250000 },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>Income summary</Text>
      <Text style={styles.subtitle}>Here&apos;s what we found from your documents.</Text>

      {incomeSources.map((source) => (
        <Card key={source.id} style={styles.row}>
          <Text style={styles.rowLabel}>{source.label}</Text>
          <Text style={styles.rowValue}>{formatNaira(source.amount)}</Text>
        </Card>
      ))}

      <Button label="Add Income Source" variant="secondary" onPress={handleAddIncome} />

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total income</Text>
        <Text style={styles.totalValue}>{formatNaira(totalIncome)}</Text>
      </Card>

      <Button
        label="Continue"
        onPress={() => router.push('/(app)/deductions')}
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
