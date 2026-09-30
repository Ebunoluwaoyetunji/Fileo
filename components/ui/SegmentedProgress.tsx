/**
 * A thin segmented progress bar: one short rounded segment per step with
 * small gaps, done segments filled (accent green by default), the rest a
 * light neutral. An optional short label sits beside it ("3 of 5 steps"),
 * with an optional icon before the label (e.g. a tick for "Filed").
 *
 * The segments keep a fixed short width, so the bar reads as steps rather
 * than a percentage; with the label they wrap onto two lines if there's no
 * room (narrow phones, larger text).
 */
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

type Props = {
  total: number;
  /** How many segments are filled, 0 to total. */
  completed: number;
  /** Short muted text beside the bar, e.g. "3 of 5 steps". */
  label?: string;
  /** Shown just before the label (16pt icon). */
  labelIcon?: ReactNode;
  fillColor?: string;
  trackColor?: string;
  /** Read out by screen readers; defaults to the label. */
  accessibilityLabel?: string;
};

const SEGMENT_WIDTH = 24;
const SEGMENT_HEIGHT = 4;
const SEGMENT_GAP = 4;

export function SegmentedProgress({
  total,
  completed,
  label,
  labelIcon,
  fillColor = colors.primary,
  trackColor = colors.border,
  accessibilityLabel,
}: Props) {
  const done = Math.max(0, Math.min(completed, total));
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? label ?? `${done} of ${total} steps`}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <View style={styles.bar}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.segment, { backgroundColor: i < done ? fillColor : trackColor }]} />
        ))}
      </View>
      {label ? (
        <View style={styles.label}>
          {labelIcon}
          <Text style={styles.labelText}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.sm + 4,
    rowGap: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    gap: SEGMENT_GAP,
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: radii.full,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  labelText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
