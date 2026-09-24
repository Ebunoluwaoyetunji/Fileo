/**
 * Upload Documents — from the Figma frame: Nigerian bank accounts show as
 * "automatically pulled" with mock summary stats, everything else needs a
 * manual upload. The frame's own example groups a Nigerian fintech
 * (Paystack) and a content platform (YouTube) together under "International
 * platforms" — so that heading is really just "needs a manual upload",
 * reproduced as-is rather than split by category.
 *
 * "Upload" / "Upload manually" pick a real file (or photo) and save it to
 * the user's account (lib/documents: private storage + a documents row).
 * The platform then counts as covered in FilingContext's
 * `uploadedDocuments`, which also remembers the document's id so "Change"
 * can upload a replacement and only then delete the old file.
 *
 * "Send upload link to my email" is still a mock (no email is sent): it
 * marks the pending platforms as covered without any file.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  UploadErrorRow,
  UploadingRow,
  useDocumentUploader,
} from '../../components/documents/useDocumentUploader';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { isNigerianBank, PLATFORM_CATEGORIES } from '../../constants/platforms';
import { DocumentCategory, deleteDocumentById } from '../../lib/documents';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

// Mock auto-pull summary — same illustrative numbers for every bank,
// matching the Figma frame's example exactly.
const MOCK_PULL_SUMMARY = {
  period: 'Jan – Dec 2025',
  transactions: '143 transactions',
  inflows: '₦4,820,000',
};

function manualUploadDescription(platform: string): string {
  const contentPlatforms = ['YouTube', 'TikTok', 'Substack', 'Patreon', 'Instagram'];
  return contentPlatforms.includes(platform)
    ? 'Earnings statement or payment report'
    : 'Transaction report or income statement';
}

const NIGERIAN_FINTECHS =
  PLATFORM_CATEGORIES.find((category) => category.title === 'Nigerian fintechs')?.platforms ?? [];

/** Bank and Nigerian fintech statements are filed as bank statements;
 * everything else (international platforms, creator earnings) as other. */
function documentCategoryFor(platform: string): DocumentCategory {
  return isNigerianBank(platform) || NIGERIAN_FINTECHS.includes(platform)
    ? 'bank_statement'
    : 'other';
}

export default function UploadDocumentsScreen() {
  const { selectedPlatforms, uploadedDocuments, documentIdsByKey, addUploadedDocument } =
    useFiling();
  const uploader = useDocumentUploader();
  const [showEmailToast, setShowEmailToast] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  const bankPlatforms = selectedPlatforms.filter(isNigerianBank);
  const manualPlatforms = selectedPlatforms.filter((platform) => !isNigerianBank(platform));
  const pendingManualPlatforms = manualPlatforms.filter((p) => !uploadedDocuments.includes(p));

  const allCovered = pendingManualPlatforms.length === 0;

  // Auto-pull banks land here too: auto-pull is informational, not a block
  // on a manual upload the user chooses to do anyway (e.g. as a fallback).
  const handleUpload = (platform: string) => {
    uploader.start({
      key: platform,
      source: 'upload_step',
      category: documentCategoryFor(platform),
      onUploaded: (document) => {
        addUploadedDocument(platform, document.id);
        setUploadToast('Document uploaded.');
      },
    });
  };

  // Bank cards' "Change" (same pattern as deductions.tsx): upload the new
  // file first; the old one is deleted only once the new one is saved, so
  // cancelling or a failed upload keeps the current document.
  const handleChangeManualUpload = (platform: string) => {
    const previousId = documentIdsByKey[platform];
    uploader.start({
      key: platform,
      source: 'upload_step',
      category: documentCategoryFor(platform),
      onUploaded: async (document) => {
        addUploadedDocument(platform, document.id);
        if (!previousId) {
          setUploadToast('Document uploaded.');
          return;
        }
        const { error } = await deleteDocumentById(previousId);
        setUploadToast(
          error
            ? 'Document replaced. We couldn’t remove the old copy, so you can delete it from Documents.'
            : 'Document replaced.'
        );
      },
    });
  };

  const handleSendEmailLink = () => {
    // Mock-only escape hatch: treats "I'll do it later via email" as
    // satisfying the requirement for now, so the flow isn't stuck waiting
    // on an email nothing here can actually send.
    pendingManualPlatforms.forEach((platform) => addUploadedDocument(platform));
    setShowEmailToast(true);
  };

  return (
    <Screen>
      <BackButton />
      <FilingProgressBar step={2} />
      <Text style={styles.title}>Upload your tax documents</Text>
      <Text style={styles.subtitle}>
        We&apos;ve automatically pulled data where we can. For international platforms, upload
        your annual statement.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {bankPlatforms.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nigerian accounts — auto pulled</Text>
            {bankPlatforms.map((bank) => {
              const isManuallyUploaded = uploadedDocuments.includes(bank);
              const uploadState = uploader.slot(bank);
              return (
                <Card key={bank} style={styles.bankCard}>
                  <View style={styles.bankHeader}>
                    <PlatformIcon label={bank} size={36} />
                    <Text style={styles.bankName}>{bank}</Text>
                    <Text style={styles.pulledLabel}>Automatically pulled</Text>
                  </View>
                  <View style={styles.pullSummary}>
                    <View style={styles.pullRow}>
                      <Text style={styles.pullLabel}>Period covered</Text>
                      <Text style={styles.pullValue}>{MOCK_PULL_SUMMARY.period}</Text>
                    </View>
                    <View style={styles.pullRow}>
                      <Text style={styles.pullLabel}>Transactions found</Text>
                      <Text style={styles.pullValue}>{MOCK_PULL_SUMMARY.transactions}</Text>
                    </View>
                    <View style={styles.pullRow}>
                      <Text style={styles.pullLabel}>Total inflows</Text>
                      <Text style={styles.pullValue}>{MOCK_PULL_SUMMARY.inflows}</Text>
                    </View>
                  </View>
                  {/* Auto-pull is informational — it doesn't stand in the way
                      of a manual upload the user wants to do anyway (e.g. as
                      a fallback if auto-pull is wrong or incomplete). Once
                      done, this switches to a plain confirmation + "Change"
                      the same way deductions.tsx confirms a document. */}
                  {uploadState.status === 'uploading' ? (
                    <UploadingRow />
                  ) : isManuallyUploaded ? (
                    <View style={styles.manualUploadConfirmRow}>
                      <View style={styles.manualUploadConfirmLeft}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                        <Text style={styles.manualUploadConfirmText}>
                          Document uploaded manually
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleChangeManualUpload(bank)}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text style={styles.changeLink}>Change</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Button
                      label="Upload manually"
                      variant="secondary"
                      onPress={() => handleUpload(bank)}
                    />
                  )}
                  <UploadErrorRow state={uploadState} onRetry={() => uploader.retry(bank)} />
                </Card>
              );
            })}
          </View>
        ) : null}

        {manualPlatforms.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>International platforms</Text>
              {pendingManualPlatforms.length > 0 ? (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredBadgeText}>Upload required</Text>
                </View>
              ) : null}
            </View>
            {manualPlatforms.map((platform) => {
              const isUploaded = uploadedDocuments.includes(platform);
              const uploadState = uploader.slot(platform);
              return (
                <Card key={platform} style={styles.uploadCard}>
                  {isUploaded ? (
                    <View style={styles.uploadedRow}>
                      <PlatformIcon label={platform} size={36} />
                      <View style={styles.uploadedTextWrap}>
                        <Text style={styles.bankName}>{platform}</Text>
                        <Text style={styles.pulledLabel}>Uploaded</Text>
                      </View>
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    </View>
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={32} color={colors.textSecondary} />
                      <Text style={styles.uploadPlatformName}>{platform}</Text>
                      <Text style={styles.uploadDescription}>
                        {manualUploadDescription(platform)}
                      </Text>
                      <Button
                        label="Upload"
                        variant="dark"
                        onPress={() => handleUpload(platform)}
                        loading={uploadState.status === 'uploading'}
                        style={styles.uploadButton}
                      />
                      <UploadErrorRow
                        state={uploadState}
                        onRetry={() => uploader.retry(platform)}
                      />
                    </>
                  )}
                </Card>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <Button
        label="Continue"
        disabled={!allCovered || uploader.isAnyUploading}
        onPress={() => router.push('/(app)/income-summary')}
        style={styles.continueButton}
      />

      <Pressable onPress={handleSendEmailLink} style={styles.emailLinkRow}>
        <Text style={styles.emailLinkText}>
          Can&apos;t upload now? <Text style={styles.emailLinkStrong}>Send upload link to my email</Text>
        </Text>
      </Pressable>

      <Toast
        visible={showEmailToast}
        message="We've sent an upload link to your email."
        onHide={() => setShowEmailToast(false)}
      />
      <Toast
        key={uploadToast ?? 'none'}
        visible={uploadToast !== null}
        message={uploadToast ?? ''}
        onHide={() => setUploadToast(null)}
      />
      {uploader.sheets}
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  requiredBadge: {
    backgroundColor: colors.warningLight,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  requiredBadgeText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
  bankCard: {
    marginBottom: spacing.sm,
  },
  bankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bankName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
  },
  pulledLabel: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  pullSummary: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  pullRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pullLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pullValue: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  manualUploadConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manualUploadConfirmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  manualUploadConfirmText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  changeLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  uploadCard: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  uploadPlatformName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  uploadDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  uploadButton: {
    paddingHorizontal: spacing.xl,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  uploadedTextWrap: {
    flex: 1,
  },
  continueButton: {
    marginTop: spacing.sm,
  },
  emailLinkRow: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  emailLinkText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emailLinkStrong: {
    color: colors.primary,
    fontWeight: '600',
  },
});
