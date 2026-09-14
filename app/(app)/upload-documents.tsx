/**
 * Upload Documents — from the Figma frame: Nigerian bank accounts show as
 * "automatically pulled" with mock summary stats, everything else needs a
 * manual upload. The frame's own example groups a Nigerian fintech
 * (Paystack) and a content platform (YouTube) together under "International
 * platforms" — so that heading is really just "needs a manual upload",
 * reproduced as-is rather than split by category.
 *
 * No real file picker or upload — "Upload" just marks that platform done
 * (stored as its name in FilingContext's `uploadedDocuments`, reused as a
 * plain "which platforms are covered" set rather than real file URIs).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { PlatformIcon } from '../../components/ui/PlatformIcon';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { isNigerianBank } from '../../constants/platforms';
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

export default function UploadDocumentsScreen() {
  const { selectedPlatforms, uploadedDocuments, addUploadedDocument } = useFiling();
  const [showEmailToast, setShowEmailToast] = useState(false);

  const bankPlatforms = selectedPlatforms.filter(isNigerianBank);
  const manualPlatforms = selectedPlatforms.filter((platform) => !isNigerianBank(platform));
  const pendingManualPlatforms = manualPlatforms.filter((p) => !uploadedDocuments.includes(p));

  const allCovered = pendingManualPlatforms.length === 0;

  const handleUpload = (platform: string) => {
    // Mock upload only — no file picker or real transfer.
    addUploadedDocument(platform);
  };

  const handleSendEmailLink = () => {
    // Mock-only escape hatch: treats "I'll do it later via email" as
    // satisfying the requirement for now, so the flow isn't stuck waiting
    // on an email nothing here can actually send.
    pendingManualPlatforms.forEach(addUploadedDocument);
    setShowEmailToast(true);
  };

  return (
    <Screen>
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
            {bankPlatforms.map((bank) => (
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
                <Button
                  label="Upload manually"
                  variant="secondary"
                  onPress={() => handleUpload(bank)}
                />
              </Card>
            ))}
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
                        style={styles.uploadButton}
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
        disabled={!allCovered}
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
