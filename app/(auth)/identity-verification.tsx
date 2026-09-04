/**
 * Identity Verification — from the Figma frame: NIN + BVN fields (each with
 * a USSD hint underneath), a "Why do we need this?" note card, and a
 * "Continue" CTA. The heading reads "Verification your identity" in the
 * frame itself — reproduced as-is; flagged separately as a likely typo
 * rather than silently changed.
 *
 * Mock-only: there's no real NIN/BVN verification service. Both fields
 * just need to be exactly 11 digits — any 11-digit value "passes". The
 * raw values are validated and immediately discarded: they're never
 * logged, and nothing here writes them into navigation params or state.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

const ID_LENGTH = 11;

function validateIdNumber(value: string, label: string): string | undefined {
  if (value.length === 0) {
    return `${label} is required.`;
  }
  if (!/^\d+$/.test(value)) {
    return `${label} must contain only numbers.`;
  }
  if (value.length !== ID_LENGTH) {
    return `${label} must be exactly ${ID_LENGTH} digits.`;
  }
  return undefined;
}

export default function IdentityVerificationScreen() {
  const { signIn } = useAuth();
  const { fullName, email } = useLocalSearchParams<{ fullName?: string; email?: string }>();

  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [ninError, setNinError] = useState<string | undefined>();
  const [bvnError, setBvnError] = useState<string | undefined>();

  const handleContinue = () => {
    const nextNinError = validateIdNumber(nin, 'NIN Number');
    const nextBvnError = validateIdNumber(bvn, 'BVN');
    setNinError(nextNinError);
    setBvnError(nextBvnError);

    if (nextNinError || nextBvnError) {
      return;
    }

    // Mock verification only — nin/bvn are validated above and discarded
    // here, never logged or persisted.
    signIn({
      id: 'local-user',
      fullName: fullName || 'FILEO User',
      email: email || '',
    });
    router.replace('/(app)/home');
  };

  return (
    <AuthScreen
      headingAccent="Verification your identity"
      headingAccentColor={colors.textPrimary}
      ctaLabel="Continue"
      onSubmitCta={handleContinue}
    >
      <TextField
        label="NIN Number"
        placeholder="Enter your 11-digit NIN"
        keyboardType="number-pad"
        value={nin}
        onChangeText={setNin}
        errorMessage={ninError}
      />
      <Text style={styles.hint}>Dial 346# on your registered number</Text>

      <TextField
        label="BVN"
        placeholder="Enter your 11-digit BVN"
        keyboardType="number-pad"
        value={bvn}
        onChangeText={setBvn}
        errorMessage={bvnError}
      />
      <Text style={styles.hint}>Dial *565*0# on any network</Text>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Why do we need this ?</Text>
        <Text style={styles.noteBody}>
          Your NIN and BVN help us verify your identity and meet tax filing requirements. We use
          your information only for verification and tax-related services.
        </Text>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  note: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noteBody: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
