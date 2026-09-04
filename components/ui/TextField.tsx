import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  errorMessage?: string;
};

export function TextField({
  label,
  errorMessage,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Password fields start hidden; the eye icon lets the user reveal it.
  const [isRevealed, setIsRevealed] = useState(false);
  const isPasswordField = secureTextEntry === true;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            errorMessage ? styles.inputError : null,
            isPasswordField && styles.inputWithIcon,
            style,
          ]}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isPasswordField && !isRevealed}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {isPasswordField ? (
          <Pressable
            onPress={() => setIsRevealed((prev) => !prev)}
            style={styles.icon}
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? 'Hide password' : 'Show password'}
            hitSlop={8}
          >
            <Ionicons
              name={isRevealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputRow: {
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.surface,
  },
  inputWithIcon: {
    paddingRight: spacing.xl + spacing.md,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.danger,
  },
  icon: {
    position: 'absolute',
    right: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
