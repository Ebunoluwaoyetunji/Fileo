/**
 * Deductions — from the Figma frame: an info card, then 4 toggleable
 * deduction categories (Rent, Life assurance, Pension, NHF), each with a
 * description of eligibility and what document it needs. A toggled-on
 * category gets a highlighted border and a document-upload prompt (also
 * from the frame) — mock upload only, marks that category's document as
 * provided in FilingContext's `uploadedDocuments` (reusing the same field
 * Upload Documents uses for platforms, namespaced with a "deduction:"
 * prefix so the two don't collide).
 *
 * Two behaviors have no Figma frame to match, so they're built to fit the
 * existing patterns instead:
 *  - Once a document is uploaded, a "Change" link (same link style as
 *    "Resend code" / "Send upload link to my email" elsewhere) swaps it
 *    back to the upload prompt so it can be replaced — mock only, same as
 *    the upload itself.
 *  - Toggling a category on without uploading its document blocks
 *    Continue, showing an inline error on that category's upload prompt —
 *    same red-border-plus-caption pattern TextField uses for its own
 *    errorMessage. Errors only appear after a Continue attempt (mirroring
 *    Create Account's on-submit validation) and clear live as each
 *    category is fixed or toggled back off.
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
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

type DeductionDefinition = {
  id: string;
  label: string;
  description: string;
  /** What "Upload your ___" should say for this category's required document. */
  documentLabel: string;
  computeAmount: (totalIncome: number) => number;
};

const DEDUCTION_DEFINITIONS: DeductionDefinition[] = [
  {
    id: 'rent',
    label: 'Rent payments',
    description:
      'If you paid rent in 2025, you can deduct up to ₦500,000 from your taxable income. Potential saving is up to ₦75,000 off your tax bill.',
    documentLabel: 'rent receipt',
    computeAmount: () => 500000,
  },
  {
    id: 'life-assurance',
    label: 'Life assurance premium',
    description:
      'Full premium paid on a life insurance policy. Document needed — insurance premium receipt from a registered insurer.',
    documentLabel: 'insurance premium receipt',
    computeAmount: () => 0,
  },
  {
    id: 'pension',
    label: 'Pension contributions',
    description:
      'If you contributed up to 8% of your monthly gross income to a registered PFA. Document needed — annual PFA statement.',
    documentLabel: 'PFA statement',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.08),
  },
  {
    id: 'nhf',
    label: 'National Housing Fund (NHF)',
    description:
      '2.5% of monthly basic salary contributed to Federal Mortgage Bank. Document needed — NHF contribution statement.',
    documentLabel: 'NHF contribution statement',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.025),
  },
];

/** Namespaced so this doesn't collide with platform names in the same array. */
const documentKey = (deductionId: string) => `deduction:${deductionId}`;

export default function DeductionsScreen() {
  const { totalIncome, setDeductions, uploadedDocuments, addUploadedDocument, removeUploadedDocument } =
    useFiling();
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  // Set on the first Continue attempt; once true, each card's error is
  // derived live from current state, so it clears itself the moment that
  // category is fixed (uploaded, or toggled back off) without extra effects.
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);

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

  const handleUploadDocument = (id: string) => {
    // Mock upload only — no real file picker or transfer.
    addUploadedDocument(documentKey(id));
  };

  const handleChangeDocument = (id: string) => {
    // Mock "replace" — drops the current document so the upload prompt
    // reappears; tapping it again produces a new mock upload.
    removeUploadedDocument(documentKey(id));
  };

  const handleContinue = () => {
    const hasMissingDocument = DEDUCTION_DEFINITIONS.some(
      (d) => enabled[d.id] && !uploadedDocuments.includes(documentKey(d.id))
    );
    if (hasMissingDocument) {
      setHasAttemptedContinue(true);
      return;
    }
    router.push('/(app)/return-review');
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

        {DEDUCTION_DEFINITIONS.map((deduction) => {
          const isEnabled = !!enabled[deduction.id];
          const isUploaded = uploadedDocuments.includes(documentKey(deduction.id));
          const showError = hasAttemptedContinue && isEnabled && !isUploaded;

          return (
            <Card
              key={deduction.id}
              style={[styles.deductionCard, isEnabled && styles.deductionCardSelected]}
            >
              <View style={styles.deductionHeader}>
                <Text style={styles.deductionTitle}>{deduction.label}</Text>
                <Switch
                  value={isEnabled}
                  onValueChange={() => toggleDeduction(deduction.id)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              <Text style={styles.deductionDescription}>{deduction.description}</Text>

              {isEnabled ? (
                isUploaded ? (
                  <View style={styles.uploadedRow}>
                    <View style={styles.uploadedLeft}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={styles.uploadedText}>Document uploaded</Text>
                    </View>
                    <Pressable
                      onPress={() => handleChangeDocument(deduction.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text style={styles.changeLink}>Change</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Pressable
                      onPress={() => handleUploadDocument(deduction.id)}
                      style={[styles.uploadPrompt, showError && styles.uploadPromptError]}
                    >
                      <Ionicons
                        name="cloud-upload-outline"
                        size={20}
                        color={showError ? colors.danger : colors.textSecondary}
                      />
                      <Text
                        style={[styles.uploadPromptText, showError && styles.uploadPromptTextError]}
                      >
                        Upload your {deduction.documentLabel}
                      </Text>
                    </Pressable>
                    {showError ? (
                      <Text style={styles.errorText}>
                        Upload your {deduction.documentLabel} to continue.
                      </Text>
                    ) : null}
                  </>
                )
              ) : null}
            </Card>
          );
        })}
      </ScrollView>

      <Button label="Continue" onPress={handleContinue} style={styles.continueButton} />
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
  deductionCardSelected: {
    borderWidth: 2,
    borderColor: colors.backgroundInverse,
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
  uploadPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.md,
  },
  uploadPromptText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  uploadPromptError: {
    borderColor: colors.danger,
  },
  uploadPromptTextError: {
    color: colors.danger,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  uploadedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  changeLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  continueButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
