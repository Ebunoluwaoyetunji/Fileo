/**
 * Bottom tab bar from the Home Figma frame. All 4 tabs are now real
 * destinations. Lucide has no filled icons, so the active tab shows a soft
 * tinted pill behind its icon (and a bold label) instead.
 */
import { Href, router } from 'expo-router';
import { FileText, Folder, House, type LucideIcon, User } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';

type TabKey = 'home' | 'file' | 'documents' | 'profile';

const TABS: {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'file', label: 'File', icon: FileText },
  { key: 'documents', label: 'Documents', icon: Folder },
  { key: 'profile', label: 'Profile', icon: User },
];

const TAB_ROUTES: Partial<Record<TabKey, Href>> = {
  home: '/(app)/home',
  file: '/(app)/filing-history',
  documents: '/(app)/documents',
  profile: '/(app)/profile',
};

type BottomTabBarProps = {
  active: TabKey;
};

export function BottomTabBar({ active }: BottomTabBarProps) {
  // The bar pads the bottom safe area itself (its screens use edges={['top']}),
  // so the area under it is always white whatever the screen's background.
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const Icon = tab.icon;
        return (
          <Pressable
            key={tab.key}
            onPress={() => handlePress(tab.key)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={[styles.iconPill, isActive && styles.iconPillActive]}>
              <Icon size={24} color={isActive ? colors.primaryButton : colors.textSecondary} />
            </View>
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
    gap: 2,
    minHeight: 48,
  },
  iconPill: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.heroTint,
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
