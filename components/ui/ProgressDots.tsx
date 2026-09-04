import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../constants/colors';
import { onboardingLayout } from '../../constants/theme';

type ProgressDotsProps = {
  total: number;
  /** 1-indexed current step. */
  current: number;
  activeColor?: string;
  inactiveColor?: string;
};

export function ProgressDots({
  total,
  current,
  activeColor = colors.primary,
  inactiveColor = colors.border,
}: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, index) => {
        const isActive = index === current - 1;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: isActive ? onboardingLayout.activeDotWidth : onboardingLayout.dotSize,
                backgroundColor: isActive ? activeColor : inactiveColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: onboardingLayout.dotGap,
  },
  dot: {
    height: onboardingLayout.dotSize,
    borderRadius: onboardingLayout.dotSize / 2,
  },
});
