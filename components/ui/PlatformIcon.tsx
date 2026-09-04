/**
 * Generic stand-in for a platform/bank logo: a colored rounded-square badge
 * with the name's initials, color picked deterministically per name. The
 * Figma frames show real brand logos (GTBank, YouTube, Paystack, ...) —
 * there's no exported asset for any of them, and redrawing ~30 trademarked
 * logos from a screenshot isn't practical, so this is a placeholder by
 * design (confirmed with the user) rather than an attempt at fidelity.
 * Swap in real logo assets later if they're exported.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '../../constants/theme';

const PALETTE = ['#0B6E4F', '#208AEF', '#D93025', '#B8860B', '#2C5A48', '#6B4EFF', '#C2410C'];

function colorForLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

type PlatformIconProps = {
  label: string;
  size?: number;
};

export function PlatformIcon({ label, size = 40 }: PlatformIconProps) {
  const initials = label.trim().slice(0, 2).toUpperCase();

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: colorForLabel(label),
        },
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.38) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodyStrong,
    color: '#FFFFFF',
  },
});
