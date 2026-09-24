/**
 * Deductions — from the Figma frame: an info card, then 4 toggleable
 * deduction categories (Rent, Life assurance, Pension, NHF), each with a
 * description of eligibility and what document it needs. A toggled-on
 * category gets a highlighted border and a document-upload prompt (also
 * from the frame). The prompt picks a real file (or photo) and saves it to
 * the user's account (lib/documents), then marks that category's document
 * as provided in FilingContext's `uploadedDocuments` (the same field
 * Upload Documents uses for platforms, namespaced with a "deduction:"
 * prefix so the two don't collide), remembering the document's id.
 *
 * Two behaviors have no Figma frame to match, so they're built to fit the
 * existing patterns instead:
 *  - Once a document is uploaded, a "Change" link (same link style as
 *    "Resend code" / "Send upload link to my email" elsewhere) uploads a
 *    replacement; the old file is deleted only after the new one is saved,
 *    so cancelling or a failed upload keeps the current document.
 *  - While uploading, the prompt shows "Uploading…"; a failed upload shows
 *    its error under the prompt, with "Try again" when that can help.
 *  - Toggling a category on without uploading its document blocks
 *    Continue, showing an inline error on that category's upload prompt —
 *    same red-border-plus-caption pattern TextField uses for its own
 *    errorMessage. Errors only appear after a Continue attempt (mirroring
 *    Create Account's on-submit validation) and clear live as each
 *    category is fixed or toggled back off.
 *
 * Each claimed deduction also has an amount field: what the user actually
 * paid in the tax year (rent paid, pension / NHF contributions, life
 * assurance premiums), in naira with commas, stored as whole kobo. The
 * server's tax rules decide how much of it is allowed (e.g. rent relief is
 * 20% of rent paid, capped) — the app never works that out. A deduction the
 * tax year doesn't allow (rent relief on a 2025 return) is shown switched
 * off with the reason from the rules, and isn't claimed.
 * ⚠️ No Figma design for the amount field or the not-available state.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { TextField } from '../../components/ui/TextField';
import { getTaxRules, ReliefRule } from '../../lib/filings';
import { checkAmount, formatNairaInput, koboToInput, parseNairaInput } from '../../lib/money';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  RequireDraft,
  SaveErrorNote,
  useFixMode,
  useSaveAndContinue,
} from '../../components/filing/FilingFlow';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import {
  UploadErrorRow,
  UploadingRow,
  useDocumentUploader,
} from '../../components/documents/useDocumentUploader';
import { colors } from '../../constants/colors';
import {
  DEDUCTION_DEFINITIONS,
  deductionAmountLabel,
  deductionDescription,
  deductionDocumentKey as documentKey,
} from '../../constants/deductions';
import { radii, spacing, typography } from '../../constants/theme';
import { deleteDocumentById } from '../../lib/documents';
import { useFiling } from '../../state/filingContext';

export default function DeductionsScreen() {
  return (
    <RequireDraft>
      <DeductionsContent />
    </RequireDraft>
  );
}

function DeductionsContent() {
  const {
    deductions,
    setDeductions,
    uploadedDocuments,
    documentIdsByKey,
    addUploadedDocument,
    taxYear,
  } = useFiling();
  const uploader = useDocumentUploader();
  // Opened from Return Review's "Fix": scroll to that deduction and show its
  // missing-document error straight away.
  const { focus } = useFixMode();
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);
  const { isSaving, error: saveError, saveAndContinue } = useSaveAndContinue(
    'return_review',
    '/(app)/return-review'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Starts from the deductions already saved on this draft (when resuming).
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(deductions.map((d) => [d.id, true]))
  );
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(deductions.map((d) => [d.id, koboToInput(d.amountPaidKobo)]))
  );
  // Which deductions this tax year allows (the server's rules), e.g. no
  // rent relief for 2025 income.
  const [reliefRules, setReliefRules] = useState<Record<string, ReliefRule> | null>(null);
  useEffect(() => {
    let isMounted = true;
    getTaxRules(taxYear).then((rules) => {
      if (isMounted && rules) {
        setReliefRules(rules.reliefs);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [taxYear]);
  const isAllowed = (id: string) => !reliefRules || reliefRules[id]?.allowed !== false;
  const isClaimed = (id: string) => !!enabled[id] && isAllowed(id);
  // Set on the first Continue attempt; once true, each card's error is
  // derived live from current state, so it clears itself the moment that
  // category is fixed (uploaded, or toggled back off) without extra effects.
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false);

  // Keep FilingContext in sync as the user toggles, so return-review sees
  // current data even if they navigate away without an explicit save step.
  useEffect(() => {
    const nextDeductions = DEDUCTION_DEFINITIONS.filter((d) => isClaimed(d.id)).map((d) => ({
      id: d.id,
      label: d.label,
      amountPaidKobo: parseNairaInput(amountInputs[d.id] ?? ''),
    }));
    setDeductions(nextDeductions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, amountInputs, reliefRules]);

  const amountError = (id: string): string | undefined => {
    const result = checkAmount(amountInputs[id] ?? '', 'Enter the amount you paid.');
    return result.error ?? undefined;
  };

  const toggleDeduction = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUploadDocument = (id: string) => {
    const definition = DEDUCTION_DEFINITIONS.find((d) => d.id === id);
    const key = documentKey(id);
    // Captured now: the document this upload replaces, if any.
    const previousId = documentIdsByKey[key];
    uploader.start({
      key,
      source: 'deductions',
      category: definition?.documentCategory ?? 'other',
      taxYear,
      onUploaded: async (document) => {
        // Point the slot at the new file before the old one goes.
        await addUploadedDocument(key, document.id);
        if (!previousId) {
          setToastMessage('Document uploaded.');
          return;
        }
        // Only now that the new one is saved.
        const { error } = await deleteDocumentById(previousId);
        setToastMessage(
          error
            ? 'Document replaced. We couldn’t remove the old copy, so you can delete it from Documents.'
            : 'Document replaced.'
        );
      },
    });
  };

  const handleContinue = () => {
    if (uploader.isAnyUploading) {
      return;
    }
    const hasMissing = DEDUCTION_DEFINITIONS.some(
      (d) =>
        isClaimed(d.id) &&
        (!uploadedDocuments.includes(documentKey(d.id)) || amountError(d.id) !== undefined)
    );
    if (hasMissing) {
      setHasAttemptedContinue(true);
      return;
    }
    saveAndContinue();
  };

  return (
    <Screen>
      <BackButton />
      <ScrollView
        ref={scrollRef}
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
          const allowed = isAllowed(deduction.id);
          const isEnabled = !!enabled[deduction.id] && allowed;
          const showAmountError =
            (hasAttemptedContinue || focus === deduction.id) && isEnabled && !!amountError(deduction.id);
          const isUploaded = uploadedDocuments.includes(documentKey(deduction.id));
          const uploadState = uploader.slot(documentKey(deduction.id));
          const isUploading = uploadState.status === 'uploading';
          const showError =
            (hasAttemptedContinue || focus === deduction.id) && isEnabled && !isUploaded && !isUploading;

          return (
            <View
              key={deduction.id}
              onLayout={
                focus === deduction.id
                  ? (event) => {
                      if (!hasScrolled.current) {
                        hasScrolled.current = true;
                        scrollRef.current?.scrollTo({
                          y: Math.max(0, event.nativeEvent.layout.y - spacing.md),
                          animated: true,
                        });
                      }
                    }
                  : undefined
              }
            >
              <Card
                style={[styles.deductionCard, isEnabled && styles.deductionCardSelected]}
              >
                <View style={styles.deductionHeader}>
                  <Text style={styles.deductionTitle}>{deduction.label}</Text>
                  <Switch
                    value={isEnabled}
                    disabled={!allowed}
                    onValueChange={() => toggleDeduction(deduction.id)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.background}
                  />
                </View>
                {allowed ? (
                  <Text style={styles.deductionDescription}>
                    {deductionDescription(deduction, taxYear)}
                  </Text>
                ) : (
                  <View style={styles.notAvailableRow}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.notAvailableText}>
                      Not available for {taxYear}.{' '}
                      {reliefRules?.[deduction.id]?.reason ?? ''}
                    </Text>
                  </View>
                )}

                {isEnabled ? (
                  <View style={styles.amountWrap}>
                    <TextField
                      label={deductionAmountLabel(deduction, taxYear)}
                      placeholder="0"
                      keyboardType="decimal-pad"
                      value={amountInputs[deduction.id] ?? ''}
                      onChangeText={(text) =>
                        setAmountInputs((prev) => ({ ...prev, [deduction.id]: formatNairaInput(text) }))
                      }
                      errorMessage={showAmountError ? amountError(deduction.id) : undefined}
                      accessibilityLabel={`${deduction.label}: amount paid in naira`}
                    />
                  </View>
                ) : null}

                {isEnabled ? (
                  isUploading ? (
                    <View style={styles.uploadingWrap}>
                      <UploadingRow />
                    </View>
                  ) : isUploaded ? (
                    <View style={styles.uploadedRow}>
                      <View style={styles.uploadedLeft}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        <Text style={styles.uploadedText}>Document uploaded</Text>
                      </View>
                      <Pressable
                        onPress={() => handleUploadDocument(deduction.id)}
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
                {isEnabled ? (
                  <UploadErrorRow
                    state={uploadState}
                    onRetry={() => uploader.retry(documentKey(deduction.id))}
                  />
                ) : null}
              </Card>
            </View>
          );
        })}
      </ScrollView>

      <Button
        label="Continue"
        onPress={handleContinue}
        disabled={uploader.isAnyUploading}
        loading={isSaving}
        style={styles.continueButton}
      />
      <SaveErrorNote message={saveError} />

      <Toast
        key={toastMessage ?? 'none'}
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
      {uploader.sheets}
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
  notAvailableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notAvailableText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  amountWrap: {
    marginTop: spacing.md,
    marginBottom: -spacing.md,
  },
  uploadingWrap: {
    marginTop: spacing.md,
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
