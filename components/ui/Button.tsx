/**
 * The app's one button. One style per variant (see DESIGN.md):
 *   primary          navy (colors.primaryButton), white text: the main action
 *   secondary        white with a border, navy text: the other option
 *                    (Cancel, Try again, Enter manually)
 *   destructive      solid red, white text: only actions that delete data
 *   inverse          white, navy text: the primary button on dark (navy)
 *                    surfaces, such as Home's filing card
 * All are pill-shaped. Disabled is a flat grey with dark grey text (not a
 * faded colour), loading keeps the colour and shows a spinner, pressed dims
 * slightly.
 */
import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'inverse';

type ButtonProps = {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  // Loading keeps the variant's colour; only a real "can't do this yet" greys out.
  const showDisabled = disabled && !loading;
  const isOutline = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        showDisabled && (isOutline ? styles.disabledOutline : styles.disabledFill),
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'inverse' ? colors.primaryButton : colors.onPrimaryButton}
        />
      ) : (
        <Text style={[styles.label, textVariantStyles[variant], showDisabled && styles.disabledText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    minHeight: 52,
    paddingVertical: spacing.sm + 6,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyStrong,
    textAlign: 'center',
  },
  disabledFill: {
    backgroundColor: colors.disabledSurface,
  },
  disabledOutline: {
    borderColor: colors.disabledSurface,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.85,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primaryButton,
  },
  secondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  inverse: {
    backgroundColor: colors.onPrimaryButton,
  },
});

const textVariantStyles = StyleSheet.create({
  primary: {
    color: colors.onPrimaryButton,
  },
  secondary: {
    color: colors.primaryButton,
  },
  destructive: {
    color: colors.onPrimaryButton,
  },
  inverse: {
    color: colors.primaryButton,
  },
});
