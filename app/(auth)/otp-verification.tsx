/**
 * OTP Verification — from the Figma frame: 6 individual code boxes, a
 * masked destination, "Resend code", and a "Verify" CTA.
 *
 * Real Supabase email OTP: signUp() (Create Account) makes Supabase email a
 * 6-digit code — the project's "Confirm signup" template sends {{ .Token }}
 * rather than a confirmation link — and this screen confirms it with
 * verifyOtp(), which also signs the user in. Success hands off to
 * app/index.tsx, which sends a new account on to Identity Verification.
 *
 * ⚠️ Copy change from the Figma frame: it said the code was sent "via SMS
 * to the number 08******33". The code now really goes to the user's email,
 * so the subtitle says that instead (SMS would need a Supabase phone
 * provider like Twilio, which isn't set up).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { OtpInput } from '../../components/ui/OtpInput';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { useAuth } from '../../state/authContext';

const CODE_LENGTH = 6;
// Matches Supabase's default minimum interval between emails to the same
// address (60s) — a shorter cooldown here would just let the user tap
// Resend into a rate-limit error. Starts running on arrival, since a code
// was sent moments ago by Create Account (or by Sign In, for an account
// that was never verified).
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
  const { verifySignUpCode, resendSignUpCode } = useAuth();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);

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

  const handleVerify = async () => {
    if (isVerifying) {
      return;
    }
    if (!email) {
      setError('Something went wrong. Go back and create your account again.');
      return;
    }
    if (code.length < CODE_LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError(undefined);
    setIsVerifying(true);
    const result = await verifySignUpCode(email, code);
    setIsVerifying(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) {
      return;
    }
    setCode('');
    setError(undefined);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const result = await resendSignUpCode(email);
    setToastMessage(result.error ?? 'A new verification code has been sent to your email.');
  };

  return (
    <>
      <AuthScreen
        headingAccent="Verification Code"
        headingAccentColor={colors.textPrimary}
        subtitle={
          email
            ? `We sent a 6-digit code to your email ${maskEmail(email)}`
            : 'We sent a 6-digit code to your email'
        }
        subtitleColor={colors.textPrimary}
        ctaLabel="Verify"
        onSubmitCta={handleVerify}
        ctaLoading={isVerifying}
        bottomLinkLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        bottomLinkOnPress={handleResend}
        bottomLinkDisabled={resendCooldown > 0}
      >
        <OtpInput length={CODE_LENGTH} value={code} onChangeValue={setCode} errorMessage={error} />
      </AuthScreen>

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </>
  );
}
