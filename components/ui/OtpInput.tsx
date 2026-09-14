/**
 * A row of single-digit boxes for entering an OTP/verification code —
 * matches the Figma frame's 6 separate boxes rather than one text field.
 * Typing a digit auto-advances focus; backspace on an empty box moves
 * focus back.
 */
import React, { useRef } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

type OtpInputProps = {
  length?: number;
  value: string;
  onChangeValue: (value: string) => void;
  errorMessage?: string;
};

export function OtpInput({ length = 6, value, onChangeValue, errorMessage }: OtpInputProps) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const handleChangeDigit = (index: number, text: string) => {
    // A paste can land multiple characters in one box; keep the last one typed.
    const char = text.slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = char;
    onChangeValue(nextDigits.join('').slice(0, length));

    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            style={[styles.box, errorMessage ? styles.boxError : null]}
            value={digit}
            onChangeText={(text) => handleChangeDigit(index, text)}
            onKeyPress={(event) => handleKeyPress(index, event)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
          />
        ))}
      </View>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    ...typography.h2,
    color: colors.textPrimary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
