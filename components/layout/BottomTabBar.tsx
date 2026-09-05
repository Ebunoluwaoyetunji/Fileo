/**
 * Bottom tab bar from the Home Figma frame. Home and File are real
 * destinations; Documents and Profile still have no screens or Figma
 * frames behind them, so they render but don't navigate anywhere yet.
 *
 * Previously this component had no onPress handling at all — not even for
 * Home — which is why tapping File (or anything else) did nothing. Tabs
 * with a route now navigate via expo-router; tabs without one are a no-op.
 */
import { Ionicons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const TAB_ROUTES: Partial<Record<TabKey, Href>> = {
  home: '/(app)/home',
  file: '/(app)/filing-history',
};

type BottomTabBarProps = {
  active: TabKey;
};

export function BottomTabBar({ active }: BottomTabBarProps) {
  const handlePress = (key: TabKey) => {
    if (key === active) {
      return;
    }
    const route = TAB_ROUTES[key];
    if (route) {
      router.push(route);
    }
  };

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? colors.textPrimary : colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
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
