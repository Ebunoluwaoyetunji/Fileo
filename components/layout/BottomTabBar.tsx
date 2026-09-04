/**
 * Presentational bottom tab bar from the Home Figma frame. Only Home is a
 * real destination today — File/Documents/Profile have no screens or
 * Figma frames yet, so they render but don't navigate anywhere until
 * those exist.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

type TabKey = 'home' | 'file' | 'documents' | 'profile';

const TABS: {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { key: 'file', label: 'File', icon: 'document-text-outline', iconActive: 'document-text' },
  { key: 'documents', label: 'Documents', icon: 'folder-outline', iconActive: 'folder' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

type BottomTabBarProps = {
  active: TabKey;
};

export function BottomTabBar({ active }: BottomTabBarProps) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <View key={tab.key} style={styles.tab}>
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? colors.textPrimary : colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
