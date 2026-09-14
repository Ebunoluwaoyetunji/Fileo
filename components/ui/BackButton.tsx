/**
 * Icon-only back button, shared across the filing flow (Select Platform,
 * Upload Documents, Income Summary, Deductions, Return Review) so every
 * step gets the same control. Matches the arrow-back pattern Return Review
 * already used before this was extracted — the one flow screen that had a
 * back button already.
 *
 * `router.back()` pops back to the previous screen instance already on the
 * stack rather than remounting it, so locally-held state (and everything in
 * FilingContext) is exactly as the user left it.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../constants/colors';
import { spacing } from '../../constants/theme';

type BackButtonProps = {
  style?: StyleProp<ViewStyle>;
};

export function BackButton({ style }: BackButtonProps) {
  return (
    <Pressable
      onPress={() => router.back()}
      style={[styles.button, style]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
});
