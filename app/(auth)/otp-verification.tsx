/**
 * OTP Verification — from the Figma frame: 6 individual code boxes, a
 * masked destination, "Resend code", and a "Verify" CTA.
 *
 * One screen for every emailed 6-digit code, chosen by the `purpose` param:
 *
 *  - signup (default): the "Confirm signup" code from Create Account.
 *    verifyOtp type 'email' signs the user in; app/index.tsx then sends a
 *    new account on to Identity Verification.
 *  - recovery: the "Reset password" code from Forgot Password. verifyOtp
 *    type 'recovery' signs the user in so Reset Password can save the new
 *    password. Wording stays neutral ("if an account exists") because no
 *    email is sent for unknown addresses.
 *  - email_change: the "Change email address" code from Edit Profile
 *    (reached via the (app)/verify-email-change route, which renders this
 *    same screen). "Secure email change" is OFF in the Supabase project, so
 *    there's one code, sent to the new address, and it completes the change.
 *
 * ⚠️ Copy change from the Figma frame: it said the code was sent "via SMS
 * to the number 08******33". Codes really go to the user's email, so the
 * subtitle says that instead.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { OtpInput } from '../../components/ui/OtpInput';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { useAuth } from '../../state/authContext';

type Purpose = 'signup' | 'recovery' | 'email_change';

const CODE_LENGTH = 6;
// Matches Supabase's default minimum interval between emails to the same
// address (60s) — a shorter cooldown here would just let the user tap
// Resend into a rate-limit error. Starts running on arrival, since a code
// was sent moments ago by the previous screen.
const RESEND_COOLDOWN_SECONDS = 60;

/** "sharon.oyelaran@gmail.com" -> "sh************@gmail.com": enough to
 * recognise which inbox to check without printing the full address. */
function maskEmail(email: string) {
  const [localPart, domain] = email.split('@');
  if (!domain || localPart.length <= 2) {
    return email;
  }
  return `${localPart.slice(0, 2)}${'*'.repeat(localPart.length - 2)}@${domain}`;
}

export default function OtpVerificationScreen() {
  const {
    verifySignUpCode,
    resendSignUpCode,
    verifyPasswordResetCode,
    requestPasswordReset,
    verifyEmailChangeCode,
    resendEmailChangeCode,
    refreshProfile,
  } = useAuth();
  const params = useLocalSearchParams<{ purpose?: Purpose; email?: string; newEmail?: string }>();
  const purpose: Purpose = params.purpose ?? 'signup';
  const { email, newEmail } = params;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [isEmailChangeComplete, setIsEmailChangeComplete] = useState(false);

  // Ticks the cooldown down once a second while it's running; the effect
  // itself just schedules one tick and cleans up, so it naturally stops
  // once resendCooldown hits 0 rather than needing its own interval-clear.
  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  /** The address the code was sent to. */
  const targetEmail = purpose === 'email_change' ? newEmail : email;

  let subtitle: string;
  if (purpose === 'recovery') {
    subtitle = email
      ? `If an account exists for ${maskEmail(email)}, we've sent it a 6-digit code.`
      : "If an account exists for that email, we've sent it a 6-digit code.";
  } else if (purpose === 'email_change') {
    subtitle = `Enter the 6-digit code we sent to your new email ${maskEmail(newEmail ?? '')}`;
  } else {
    subtitle = email
      ? `We sent a 6-digit code to your email ${maskEmail(email)}`
      : 'We sent a 6-digit code to your email';
  }

  const handleVerify = async () => {
    if (isVerifying || isEmailChangeComplete) {
      return;
    }
    if (!targetEmail) {
      setError('Something went wrong. Please go back and try again.');
      return;
    }
    if (code.length < CODE_LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(undefined);
    setIsVerifying(true);

    if (purpose === 'recovery') {
      const result = await verifyPasswordResetCode(targetEmail, code);
      setIsVerifying(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace('/(auth)/reset-password');
      return;
    }

    if (purpose === 'email_change') {
      const result = await verifyEmailChangeCode(targetEmail, code);
      if (result.error) {
        setIsVerifying(false);
        setError(result.error);
        return;
      }
      // Changed. The database trigger has already copied the new address
      // into profiles; reload it so every screen shows it.
      await refreshProfile();
      setIsVerifying(false);
      setIsEmailChangeComplete(true);
      setToastMessage('Your email address has been updated.');
      return;
    }

    const result = await verifySignUpCode(targetEmail, code);
    setIsVerifying(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isEmailChangeComplete) {
      return;
    }
    setCode('');
    setError(undefined);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    if (purpose === 'recovery') {
      if (!email) {
        return;
      }
      const result = await requestPasswordReset(email);
      setToastMessage(result.error ?? "If an account exists for this email, we've sent a new code.");
      return;
    }

    if (purpose === 'email_change') {
      const result = await resendEmailChangeCode();
      setToastMessage(result.error ?? "We've sent a new code to your new email.");
      return;
    }

    if (!email) {
      return;
    }
    const result = await resendSignUpCode(email);
    setToastMessage(result.error ?? 'A new verification code has been sent to your email.');
  };

  return (
    <>
      <AuthScreen
        headingAccent="Verification Code"
        headingAccentColor={colors.textPrimary}
        subtitle={subtitle}
        subtitleColor={colors.textPrimary}
        ctaLabel="Verify"
        onSubmitCta={handleVerify}
        ctaLoading={isVerifying}
        bottomLinkLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        bottomLinkOnPress={handleResend}
        bottomLinkDisabled={resendCooldown > 0 || isEmailChangeComplete}
      >
        <OtpInput length={CODE_LENGTH} value={code} onChangeValue={setCode} errorMessage={error} />
      </AuthScreen>

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => {
          setToastMessage(null);
          if (isEmailChangeComplete) {
            router.dismissTo('/(app)/profile');
          }
        }}
      />
    </>
  );
}
