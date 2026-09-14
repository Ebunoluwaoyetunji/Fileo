/**
 * Notifications — where the Home screen's bell icon now goes, instead of
 * just popping a "No new notifications." toast.
 *
 * ⚠️ PLACEHOLDER UI — there's no Figma frame for this screen yet. Nothing
 * in the app currently generates a real notification (no push service, no
 * background job), so the only honest state to build is the empty one —
 * matching the same empty-state shape already used on the Filing and
 * Documents tabs (icon in a circle, title, body). If/when real
 * notifications exist, this is where a list of them would render instead.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

export default function NotificationsScreen() {
  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backLabel}>Home</Text>
      </Pressable>

      <Text style={styles.title}>Notifications</Text>

      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="notifications-outline" size={32} color={colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>No notifications yet</Text>
        <Text style={styles.emptyBody}>
          Updates about your filings — like status changes and reminders — will show up here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
