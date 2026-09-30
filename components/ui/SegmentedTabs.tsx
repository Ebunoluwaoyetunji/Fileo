/**
 * Pill-shaped segmented control: a light grey rounded track with the active
 * tab as a white pill that slides between tabs (native driver). Full width;
 * each tab is at least 44pt tall and grows with larger system text.
 *
 *   <SegmentedTabs
 *     tabs={[{ key: 'summary', label: 'Summary' }, { key: 'calc', label: 'Calculation' }]}
 *     value={tab}
 *     onChange={setTab}
 *   />
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { radii, typography } from '../../constants/theme';

export type SegmentedTab<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  tabs: SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PADDING = 4;
const SLIDE_MS = 220;
const COMPACT_BELOW = 100;

export function SegmentedTabs<K extends string>({ tabs, value, onChange, style }: Props<K>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((tab) => tab.key === value));
  const tabWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / tabs.length : 0;
  // Narrow tracks (small phones, many tabs): slightly smaller labels.
  const compact = tabWidth > 0 && tabWidth < COMPACT_BELOW;
  const offset = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  useEffect(() => {
    if (!tabWidth) {
      return;
    }
    // Jump into place the first time; slide after that.
    if (!placed.current) {
      placed.current = true;
      offset.setValue(index * tabWidth);
      return;
    }
    Animated.timing(offset, {
      toValue: index * tabWidth,
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, tabWidth, offset]);

  const handleLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View style={[styles.track, style]} onLayout={handleLayout} accessibilityRole="tablist">
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: tabWidth, transform: [{ translateX: offset }] }]}
        />
      ) : null}
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            {/* Wraps rather than truncating (larger system text). */}
            <Text style={[styles.label, compact && styles.labelCompact, selected && styles.labelSelected]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radii.full,
    padding: TRACK_PADDING,
  },
  pill: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    backgroundColor: colors.background,
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  labelSelected: {
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
