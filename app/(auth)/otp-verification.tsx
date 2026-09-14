/**
 * OTP Verification — from the Figma frame: 6 individual code boxes, a
 * masked phone number, "Resend code", and a "Verify" CTA.
 *
 * Mock-only: there's no real OTP service, so "123456" is the one code
 * that's treated as correct. Resend just re-shows the toast — it doesn't
 * actually generate or send anything.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { OtpInput } from '../../components/ui/OtpInput';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';

const MOCK_VALID_CODE = '123456';
const CODE_LENGTH = 6;
const FALLBACK_PHONE = '08000000000';
// Mock delay so the CTA's loading state feels like a real request — there's
// still no backend underneath, this just avoids an instant, jarring jump.
const MOCK_VERIFY_DELAY_MS = 900;
const RESEND_COOLDOWN_SECONDS = 30;

/** Keeps the first/last 2 characters visible, masking the rest — matches
 * the Figma frame's "08******33" pattern. */
function maskPhone(phone: string) {
  if (phone.length <= 4) {
    return phone;
  }
  const start = phone.slice(0, 2);
  const end = phone.slice(-2);
  return `${start}${'*'.repeat(phone.length - 4)}${end}`;
}

export default function OtpVerificationScreen() {
  const { phone, fullName, email } = useLocalSearchParams<{
    phone?: string;
    fullName?: string;
    email?: string;
  }>();
  const maskedPhone = maskPhone(phone || FALLBACK_PHONE);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [showResendToast, setShowResendToast] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  const handleVerify = () => {
    if (isVerifying) {
      return;
    }
    if (code.length < CODE_LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    if (code !== MOCK_VALID_CODE) {
      setError('Incorrect code. Please try again.');
      return;
    }
    setError(undefined);
    setIsVerifying(true);
    setTimeout(() => {
      router.push({
        pathname: '/(auth)/identity-verification',
        params: { fullName: fullName ?? '', email: email ?? '', phone: phone ?? '' },
      });
    }, MOCK_VERIFY_DELAY_MS);
  };

  const handleResend = () => {
    if (resendCooldown > 0) {
      return;
    }
    setCode('');
    setError(undefined);
    setShowResendToast(true);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <>
      <AuthScreen
        headingAccent="Verification Code"
        headingAccentColor={colors.textPrimary}
        subtitle={`We sent a 6-digit code via SMS to the number ${maskedPhone}`}
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
        visible={showResendToast}
        message="A new verification code has been sent to your email and phone number."
        onHide={() => setShowResendToast(false)}
      />
    </>
  );
}
