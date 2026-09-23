/**
 * Identity Verification — from the Figma frame: NIN + BVN fields (each with
 * a USSD hint underneath), a "Why do we need this?" note card, and a
 * "Continue" CTA. The heading reads "Verification your identity" in the
 * frame itself — reproduced as-is; flagged separately as a likely typo
 * rather than silently changed.
 *
 * The decision is made on the server now: each number is sent to the
 * verify-identity Edge Function (NIN first, then BVN), which checks it with
 * the identity provider (a mock for now) and — only once BOTH pass — marks
 * the profile identity_verified. The app can't set that itself any more; a
 * database trigger rejects it. The 11-digit check here is just a quick
 * first pass so obviously wrong input doesn't use up one of the user's
 * 5 attempts per 24 hours.
 *
 * Numbers go to the server over HTTPS and are never logged, stored raw, or
 * put in navigation params. The server stores only the last 4 digits.
 *
 * Reached right after OTP Verification signs a new user in (via
 * app/index.tsx), or on a later launch if the user never finished this
 * step.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { type IdentityCheckType, verifyIdentity } from '../../lib/verifyIdentity';
import { useAuth } from '../../state/authContext';

const ID_LENGTH = 11;

const MISMATCH_MESSAGE = "The details don't match the name on your account.";
const NOT_FOUND_MESSAGE = "We couldn't find this number. Check it and try again.";
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const RATE_LIMIT_FALLBACK_MESSAGE =
  "You've reached the limit of 5 verification attempts in 24 hours. Please try again tomorrow.";

const CHECK_LABEL: Record<IdentityCheckType, string> = { nin: 'NIN', bvn: 'BVN' };

/** Same "*******1234" shape the server stores, to recognise a number that
 * already passed on an earlier try. */
function maskLastFour(value: string) {
  return `${'*'.repeat(7)}${value.slice(-4)}`;
}

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
  const { profile, refreshProfile } = useAuth();

  const [nin, setNin] = useState('');
  const [bvn, setBvn] = useState('');
  const [ninError, setNinError] = useState<string | undefined>();
  const [bvnError, setBvnError] = useState<string | undefined>();
  /** Errors that aren't about one field: server/network trouble, rate limit. */
  const [notice, setNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  /** Which number is being checked right now, for the loading line. */
  const [checking, setChecking] = useState<IdentityCheckType | null>(null);

  const handleContinue = async () => {
    if (isVerifying) {
      return;
    }

    const nextNinError = validateIdNumber(nin, 'NIN Number');
    const nextBvnError = validateIdNumber(bvn, 'BVN');
    setNinError(nextNinError);
    setBvnError(nextBvnError);
    setNotice(null);

    if (nextNinError || nextBvnError) {
      return;
    }

    setIsVerifying(true);
    const checks: { type: IdentityCheckType; number: string; setError: (m?: string) => void }[] = [
      { type: 'nin', number: nin, setError: setNinError },
      { type: 'bvn', number: bvn, setError: setBvnError },
    ];

    for (const check of checks) {
      // Passed on an earlier try (e.g. NIN passed, BVN didn't)? Don't spend
      // another of the user's attempts checking it again.
      const storedMask = check.type === 'nin' ? profile?.nin_masked : profile?.bvn_masked;
      if (storedMask && storedMask === maskLastFour(check.number)) {
        continue;
      }

      setChecking(check.type);
      const result = await verifyIdentity(check.type, check.number);
      if (result.status === 'verified') {
        continue;
      }

      if (result.status === 'mismatch') {
        check.setError(MISMATCH_MESSAGE);
      } else if (result.status === 'not_found') {
        check.setError(NOT_FOUND_MESSAGE);
      } else if (result.status === 'rate_limited') {
        setNotice(result.message ?? RATE_LIMIT_FALLBACK_MESSAGE);
      } else {
        setNotice(GENERIC_ERROR_MESSAGE);
      }
      // The other number may have just passed; pick that up so a retry
      // skips it.
      await refreshProfile();
      setChecking(null);
      setIsVerifying(false);
      return;
    }

    const updatedProfile = await refreshProfile();
    setChecking(null);
    setIsVerifying(false);
    if (updatedProfile?.identity_verified) {
      router.replace('/(app)/home');
    } else {
      setNotice(GENERIC_ERROR_MESSAGE);
    }
  };

  return (
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
        editable={!isVerifying}
      />
      <Text style={styles.hint}>Dial 346# on your registered number</Text>

      <TextField
        label="BVN"
        placeholder="Enter your 11-digit BVN"
        keyboardType="number-pad"
        value={bvn}
        onChangeText={setBvn}
        errorMessage={bvnError}
        editable={!isVerifying}
      />
      <Text style={styles.hint}>Dial *565*0# on any network</Text>

      {checking ? (
        <Text style={styles.checking}>Checking your {CHECK_LABEL[checking]}…</Text>
      ) : null}

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

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
  checking: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
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
