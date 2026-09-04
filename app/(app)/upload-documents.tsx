import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

export default function UploadDocumentsScreen() {
  const { uploadedDocuments, addUploadedDocument } = useFiling();

  const handleAddDocument = () => {
    // Placeholder until document picking (expo-document-picker) is wired up.
    addUploadedDocument(`document-${uploadedDocuments.length + 1}.pdf`);
  };

  return (
    <Screen>
      <Text style={styles.title}>Upload your documents</Text>
      <Text style={styles.subtitle}>
        Add payslips, invoices, or statements for the income sources you selected.
      </Text>

      {uploadedDocuments.map((document) => (
        <Card key={document} style={styles.documentCard}>
          <Text style={styles.documentLabel}>{document}</Text>
        </Card>
      ))}

      <Button label="Add Document" variant="secondary" onPress={handleAddDocument} />

      <Button
        label="Continue"
        disabled={uploadedDocuments.length === 0}
        onPress={() => router.push('/(app)/income-summary')}
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
  documentCard: {
    marginBottom: spacing.sm,
  },
  documentLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  continueButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
});
