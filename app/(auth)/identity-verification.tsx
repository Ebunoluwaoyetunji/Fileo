/**
 * Identity Verification — from the Figma frame: NIN + BVN fields (each with
 * a USSD hint underneath), a "Why do we need this?" note card, and a
 * "Continue" CTA. The heading reads "Verification your identity" in the
 * frame itself — reproduced as-is; flagged separately as a likely typo
 * rather than silently changed.
 *
 * The verification itself is still a mock: there's no real NIN/BVN
 * provider, so any value that's exactly 11 digits "passes". What's real now
 * is where the result goes — recordIdentityVerification() writes
 * identity_verified = true to the signed-in user's Supabase profiles row,
 * along with masked copies of both numbers (last 4 digits only, masked on
 * the device before anything is sent). The raw values are never logged,
 * never put in navigation params, and never leave the device.
 *
 * Reached right after OTP Verification signs a new user in (via
 * app/index.tsx), or on a later launch if the user never finished this
 * step.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
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
  const { recordIdentityVerification } = useAuth();

  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [ninError, setNinError] = useState<string | undefined>();
  const [bvnError, setBvnError] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleContinue = async () => {
    if (isVerifying) {
      return;
    }

    const nextNinError = validateIdNumber(nin, 'NIN Number');
    const nextBvnError = validateIdNumber(bvn, 'BVN');
    setNinError(nextNinError);
    setBvnError(nextBvnError);

    if (nextNinError || nextBvnError) {
      return;
    }

    setIsVerifying(true);
    // Masked inside recordIdentityVerification before the request is made.
    const result = await recordIdentityVerification({ nin, bvn });
    setIsVerifying(false);
    if (result.error) {
      setToastMessage(result.error);
      return;
    }
    router.replace('/(app)/home');
  };

  return (
    <>
      <AuthScreen
        headingAccent="Verification your identity"
        headingAccentColor={colors.textPrimary}
        ctaLabel="Continue"
        onSubmitCta={handleContinue}
        ctaLoading={isVerifying}
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

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </>
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
