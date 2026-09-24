/**
 * One line (or a few) about the AI reading of a statement: "Reading your
 * statement…", what period it covers, any warnings, or — if it couldn't be
 * read — a friendly reason, "Try again" when that could help, and the
 * reminder that the amount can simply be typed. Never blocks anything.
 *
 * Used on Upload Documents (compact: status only) and Income Summary
 * (full: period and warnings too).
 *
 * ⚠️ No Figma design for any of these states — built from the existing
 * caption text styles, icons and colour tokens.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import {
  canRetry,
  failureMessage,
  formatPeriod,
  isReading,
  warningMessage,
} from '../../lib/extractions';
import { useFiling } from '../../state/filingContext';

type Props = {
  documentId: string | undefined;
  /** Compact: status only. Full: also the period and warnings. */
  variant?: 'compact' | 'full';
};

export function StatementReadingStatus({ documentId, variant = 'compact' }: Props) {
  const { extractionsByDocumentId, extractionStartErrors, readStatement, taxYear, aiConsent } = useFiling();
  if (!documentId) {
    return null;
  }
  const extraction = extractionsByDocumentId[documentId];
  const startError = extractionStartErrors[documentId];

  if (startError && !isReading(extraction)) {
    return (
      <View style={styles.row}>
        <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
        <Text style={styles.warningText}>{startError}</Text>
      </View>
    );
  }
  if (!extraction) {
    return null;
  }
  if (isReading(extraction)) {
    return (
      <View style={styles.row} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.text}>
          Reading your statement… You can keep going; we’ll fill in the amount when it’s ready.
        </Text>
      </View>
    );
  }
  if (extraction.status === 'done') {
    const period = formatPeriod(extraction);
    return (
      <View style={styles.block}>
        <View style={styles.row}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.text}>
            {period ? `Statement read: ${period}` : 'Statement read'}
          </Text>
        </View>
        {variant === 'full'
          ? extraction.warnings.map((warning) => (
              <View key={warning} style={styles.row}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.warningText}>{warningMessage(warning, extraction, taxYear)}</Text>
              </View>
            ))
          : null}
      </View>
    );
  }
  // failed / unreadable / abandoned
  const retry = canRetry(extraction) && aiConsent === 'allowed';
  return (
    <View style={styles.row}>
      <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
      <View style={styles.failure}>
        <Text style={styles.warningText}>{failureMessage(extraction)}</Text>
        {retry ? (
          <Pressable
            onPress={() => readStatement(documentId)}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.retry}
          >
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  warningText: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  failure: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  retry: {
    alignSelf: 'flex-start',
  },
  link: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
});
