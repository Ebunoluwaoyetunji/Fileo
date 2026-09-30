/**
 * Vertical step list with a thin connector line and small markers: each step
 * has a label and an optional right-aligned value, and can carry a small
 * green section name above it, a muted line under it, and a list of small
 * sub-rows. The last step is usually the result ("final": bold, with a
 * filled green marker).
 *
 *   <Timeline
 *     items={[
 *       { key: 'income', section: 'Income', label: 'Total income', value: '₦5,770,000' },
 *       { key: 'due', label: 'Tax due', value: '₦669,248', tone: 'final' },
 *     ]}
 *   />
 */
import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, tabularNumbers, typography } from '../../constants/theme';

export type TimelineSubItem = {
  key: string;
  label: string;
  value?: string;
  /** Greyed out (e.g. not applied). */
  muted?: boolean;
  /** A short line under the sub-row. */
  note?: string;
};

export type TimelineItem = {
  key: string;
  label: string;
  value?: string;
  /** Small green name of the section this step starts, shown above it. */
  section?: string;
  /** A short muted line under the step. */
  detail?: string;
  subItems?: TimelineSubItem[];
  /** "strong": bold step. "final": the result, bold with a filled marker. */
  tone?: 'default' | 'strong' | 'final';
  /** Extra content under the step. */
  children?: ReactNode;
};

type Props = {
  items: TimelineItem[];
  style?: StyleProp<ViewStyle>;
};

const GUTTER = 20;
const LINE_HEIGHT = typography.body.lineHeight;

export function Timeline({ items, style }: Props) {
  return (
    <View style={style}>
      {items.map((item, index) => {
        const first = index === 0;
        const last = index === items.length - 1;
        const final = item.tone === 'final';
        const strong = final || item.tone === 'strong';
        return (
          <View key={item.key}>
            {item.section ? (
              <View style={styles.row}>
                <View style={styles.gutter}>{first ? null : <View style={[styles.line, styles.lineFull]} />}</View>
                <Text style={styles.section}>{item.section}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <View style={styles.gutter}>
                {first ? null : <View style={[styles.line, styles.lineTop]} />}
                {last ? null : <View style={[styles.line, styles.lineBottom]} />}
                <View style={[styles.marker, final ? styles.markerFinal : strong && styles.markerStrong]} />
              </View>
              <View style={[styles.content, !last && styles.contentSpaced]}>
                <View style={styles.mainRow}>
                  <Text style={[styles.label, strong && styles.labelStrong, final && styles.labelFinal]}>
                    {item.label}
                  </Text>
                  {item.value !== undefined ? (
                    <Text style={[styles.value, strong && styles.valueStrong, final && styles.valueFinal]}>
                      {item.value}
                    </Text>
                  ) : null}
                </View>
                {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
                {item.subItems?.length ? (
                  <View style={styles.subList}>
                    {item.subItems.map((sub) => (
                      <View key={sub.key}>
                        <View style={styles.subRow}>
                          <Text style={[styles.subLabel, sub.muted && styles.subMuted]}>{sub.label}</Text>
                          {sub.value !== undefined ? (
                            <Text style={[styles.subValue, sub.muted && styles.subMuted]}>{sub.value}</Text>
                          ) : null}
                        </View>
                        {sub.note ? <Text style={styles.subNote}>{sub.note}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : null}
                {item.children}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MARKER = 9;
const MARKER_FINAL = 12;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  gutter: {
    width: GUTTER,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  line: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.border,
  },
  lineFull: {
    top: 0,
    bottom: 0,
  },
  lineTop: {
    top: 0,
    height: LINE_HEIGHT / 2,
  },
  lineBottom: {
    top: LINE_HEIGHT / 2,
    bottom: 0,
  },
  marker: {
    marginTop: (LINE_HEIGHT - MARKER) / 2,
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 1.5,
    borderColor: colors.mutedStroke,
    backgroundColor: colors.background,
  },
  markerStrong: {
    borderColor: colors.textPrimary,
  },
  markerFinal: {
    marginTop: (LINE_HEIGHT - MARKER_FINAL) / 2,
    width: MARKER_FINAL,
    height: MARKER_FINAL,
    borderRadius: MARKER_FINAL / 2,
    borderWidth: 3,
    borderColor: colors.primaryLight,
    backgroundColor: colors.primary,
  },
  section: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.primary,
    paddingBottom: spacing.xs,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentSpaced: {
    paddingBottom: spacing.md,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  labelStrong: {
    fontWeight: '600',
  },
  labelFinal: {
    fontSize: 17,
    fontWeight: '700',
  },
  value: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  valueStrong: {
    fontWeight: '600',
  },
  valueFinal: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subList: {
    marginTop: spacing.xs,
    gap: 2,
  },
  subRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  subLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  subValue: {
    ...typography.caption,
    ...tabularNumbers,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  subMuted: {
    color: colors.textSecondary,
  },
  subNote: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginBottom: 2,
  },
});
