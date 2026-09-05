/**
 * Confirmation — from the Figma frame: an approval stepper (4 steps, each
 * with a status pill), a "what's next" note, and Download Summary / Done.
 *
 * Mock/local only: nothing here is actually submitted to FIRS or any real
 * tax authority. "Professional review", "Filed with LIRS", and
 * "Confirmation email" are static illustrative steps, not a real
 * background process — there's no timer or job actually advancing them.
 * "Download Summary" can't generate or save a real file in this prototype,
 * so it says so via a toast rather than pretending to produce one.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

// Scalloped-seal success icon exported from Figma — not a standard icon-font
// glyph, so it's a static asset rather than built from shapes.
const sealIcon = require('../../assets/images/confirmation-seal-icon.png');

// The stepper reuses the same seal, recolored per step status (outline +
// checkmark only — the white face stays white at every stage). These are
// pre-recolored copies of the asset above rather than a runtime tint, since
// a single-color tint would also flatten the white face to that color.
type StepStatus = 'completed' | 'in-progress' | 'waiting';

const STEP_SEAL_ICONS: Record<StepStatus, ReturnType<typeof require>> = {
  completed: require('../../assets/images/confirmation-seal-icon-completed.png'),
  'in-progress': require('../../assets/images/confirmation-seal-icon-in-progress.png'),
  waiting: require('../../assets/images/confirmation-seal-icon-waiting.png'),
};

type Step = {
  id: string;
  label: string;
  status: StepStatus;
  meta?: string;
};

const STATUS_STYLES: Record<StepStatus, { bg: string; text: string; label: string }> = {
  completed: { bg: '#DCEFE3', text: colors.success, label: 'Completed' },
  'in-progress': { bg: colors.warningLight, text: colors.warning, label: 'In progress' },
  waiting: { bg: colors.border, text: colors.textSecondary, label: 'Waiting' },
};

export default function ConfirmationScreen() {
  const { resetFiling } = useFiling();
  const [showDownloadToast, setShowDownloadToast] = useState(false);

  const [approvedAt] = useState(() => new Date());
  const approvedTime = approvedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const approvedDate = approvedAt.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const steps: Step[] = [
    { id: 'approved', label: 'Approved by you', status: 'completed' },
    { id: 'professional-review', label: 'Professional review', status: 'in-progress', meta: 'Takes 2 hours' },
    { id: 'filed', label: 'Filed with LIRS', status: 'waiting' },
    { id: 'email', label: 'Confirmation email', status: 'waiting' },
  ];

  const handleDone = () => {
    resetFiling();
    router.replace('/(app)/home');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.handle} />

      <Image source={sealIcon} style={styles.icon} contentFit="contain" />
      <Text style={styles.title}>Your return has been approved.</Text>
      <Text style={styles.subtitle}>
        We&apos;ll now review your return before submitting it. We&apos;ll keep you updated as
        each step is completed.
      </Text>

      <View style={styles.stepperCard}>
        {steps.map((step, index) => {
          const statusStyle = STATUS_STYLES[step.status];
          const isLast = index === steps.length - 1;
          return (
            <View key={step.id} style={styles.stepRow}>
              <View style={styles.stepIconColumn}>
                <Image
                  source={STEP_SEAL_ICONS[step.status]}
                  style={styles.stepSeal}
                  contentFit="contain"
                />
                {!isLast ? <View style={styles.stepConnector} /> : null}
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepTopRow}>
                  <Text style={styles.stepLabel}>{step.label}</Text>
                  {step.status === 'completed' ? (
                    <Text style={styles.stepMeta}>{approvedTime}{'\n'}{approvedDate}</Text>
                  ) : null}
                </View>
                <View style={styles.stepBottomRow}>
                  <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusPillText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                  {step.status === 'in-progress' && step.meta ? (
                    <View style={styles.stepMetaRow}>
                      <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.stepMetaText}>{step.meta}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.whatsNextNote}>
        <Text style={styles.whatsNextTitle}>What&apos;s next?</Text>
        <Text style={styles.whatsNextBody}>
          Our tax professionals are reviewing your return. Once the review is complete, we&apos;ll
          submit to FIRS and email you the confirmation and receipt.
        </Text>
      </View>

      <Button
        label="Download Summary"
        variant="dark"
        onPress={() => setShowDownloadToast(true)}
        style={styles.downloadButton}
      />
      <Button label="Done" variant="ghost" onPress={handleDone} />
      </ScrollView>

      <Toast
        visible={showDownloadToast}
        message="Downloading a summary isn't available in this preview yet."
        onHide={() => setShowDownloadToast(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  icon: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  stepperCard: {
    width: '100%',
    backgroundColor: colors.warningLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
  },
  stepIconColumn: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  stepSeal: {
    width: 28,
    height: 28,
  },
  stepConnector: {
    width: 2,
    flex: 1,
    minHeight: spacing.xl,
    backgroundColor: colors.backgroundInverse,
    marginVertical: spacing.xs,
  },
  stepContent: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  stepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  stepLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  stepMeta: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  stepBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusPillText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  stepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stepMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  whatsNextNote: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  whatsNextTitle: {
    ...typography.bodyStrong,
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  whatsNextBody: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  downloadButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
});
