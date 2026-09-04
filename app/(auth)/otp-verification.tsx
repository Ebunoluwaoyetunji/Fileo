/**
 * OTP Verification — from the Figma frame: 6 individual code boxes, a
 * masked phone number, "Resend code", and a "Verify" CTA.
 *
 * Mock-only: there's no real OTP service, so "123456" is the one code
 * that's treated as correct. Resend just re-shows the toast — it doesn't
 * actually generate or send anything.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { OtpInput } from '../../components/ui/OtpInput';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';

const MOCK_VALID_CODE = '123456';
const CODE_LENGTH = 6;
const FALLBACK_PHONE = '08000000000';

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
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const maskedPhone = maskPhone(phone || FALLBACK_PHONE);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [showResendToast, setShowResendToast] = useState(false);

  const handleVerify = () => {
    if (code.length < CODE_LENGTH) {
      setError('Enter the 6-digit code.');
      return;
    }
    if (code !== MOCK_VALID_CODE) {
      setError('Incorrect code. Please try again.');
      return;
    }
    setError(undefined);
    router.push('/(auth)/identity-verification');
  };

  const handleResend = () => {
    setCode('');
    setError(undefined);
    setShowResendToast(true);
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
        bottomLinkLabel="Resend code"
        bottomLinkOnPress={handleResend}
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
