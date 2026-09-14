/**
 * The 3-segment progress bar at the top of each filing-flow screen (Select
 * Platform, Upload Documents, Income Summary) — segments fill cumulatively
 * up to and including the current step.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';
import { radii, spacing } from '../../constants/theme';

type FilingProgressBarProps = {
  step: number;
  totalSteps?: number;
};

export function FilingProgressBar({ step, totalSteps = 3 }: FilingProgressBarProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View key={index} style={[styles.segment, index < step && styles.segmentActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  segmentActive: {
    backgroundColor: colors.backgroundInverse,
  },
});
