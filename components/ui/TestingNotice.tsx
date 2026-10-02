/**
 * The early-testing reminder, kept quiet so it doesn't spoil the screen:
 *   card  a soft green-tinted note (top of Privacy, Terms and About)
 *   line  one small muted line (Create Account, Identity, Upload Documents)
 * Hidden everywhere when SHOW_TESTING_NOTICE is false (constants/app.ts).
 */
import { FlaskConical } from 'lucide-react-native';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SHOW_TESTING_NOTICE } from '../../constants/app';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

const CARD_TEXT =
  'Fileo is in early testing. Please use test details only, not your real BVN, NIN or bank statements.';
const LINE_TEXT = 'Early testing: use test details only.';

type Props = {
  variant?: 'card' | 'line';
  style?: StyleProp<ViewStyle>;
};

export function TestingNotice({ variant = 'line', style }: Props) {
  if (!SHOW_TESTING_NOTICE) {
    return null;
  }
  if (variant === 'line') {
    return (
      <Text style={[styles.line, style as never]} accessibilityRole="text">
        {LINE_TEXT}
      </Text>
    );
  }
  return (
    <View style={[styles.card, style]} accessibilityRole="text">
      <FlaskConical size={16} color={colors.primaryDark} style={styles.icon} />
      <Text style={styles.cardText}>{CARD_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  icon: {
    marginTop: 1,
  },
  cardText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
});
