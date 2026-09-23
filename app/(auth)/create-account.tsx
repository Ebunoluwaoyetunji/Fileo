/**
 * Create Account — matches the Figma frame the user provided: FILEO
 * wordmark, "Create your Fileo account" heading, full name / email / phone
 * / password fields, and a "Login" link for existing users.
 *
 * Local validation is presence-only (plus a password match check); the
 * rest — email format, password strength, already-registered email — comes
 * back from Supabase's signUp() and is shown on the matching field. On
 * success Supabase emails a 6-digit code and this moves on to OTP
 * Verification. full_name/phone go in as signup metadata, which the
 * on_auth_user_created trigger copies into the user's profiles row.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { useAuth } from '../../state/authContext';

// Supabase error codes that are about the email itself vs. the password,
// so the message lands on the field the user needs to fix.
const EMAIL_ERROR_CODES = ['user_already_exists', 'email_exists', 'email_address_invalid', 'validation_failed'];
const PASSWORD_ERROR_CODES = ['weak_password'];

export default function CreateAccountScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAccount = async () => {
    if (isSubmitting) {
      return;
    }
    const nextFullNameError = fullName.trim().length === 0 ? 'Enter your full name.' : undefined;
    const nextEmailError = email.trim().length === 0 ? 'Enter your email address.' : undefined;
    const nextPhoneError = phone.trim().length === 0 ? 'Enter your phone number.' : undefined;
    const nextPasswordError = password.length === 0 ? 'Enter a password.' : undefined;
    const nextConfirmPasswordError =
      confirmPassword.length === 0
        ? 'Confirm your password.'
        : confirmPassword !== password
          ? 'Passwords do not match.'
          : undefined;

    setFullNameError(nextFullNameError);
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);

    const hasError = [
      nextFullNameError,
      nextEmailError,
      nextPhoneError,
      nextPasswordError,
      nextConfirmPasswordError,
    ].some(Boolean);
    if (hasError) {
      return;
    }

    const trimmedEmail = email.trim();
    setIsSubmitting(true);
    const result = await signUp({
      fullName: fullName.trim(),
      email: trimmedEmail,
      phone: phone.trim(),
      password,
    });
    setIsSubmitting(false);

    if (result.error) {
      if (result.code && EMAIL_ERROR_CODES.includes(result.code)) {
        setEmailError(result.error);
      } else if (result.code && PASSWORD_ERROR_CODES.includes(result.code)) {
        setPasswordError(result.error);
      } else {
        setToastMessage(result.error);
      }
      return;
    }

    // Only if "Confirm email" is turned off in Supabase — signed in
    // already, no code to enter.
    if (result.code === 'signed_in') {
      router.replace('/');
      return;
    }

    router.push({ pathname: '/(auth)/otp-verification', params: { email: trimmedEmail } });
  };

  return (
    <>
      <AuthScreen
        headingAccent="Create"
        headingRest=" your Fileo account"
        subtitle="Get started with a simpler way to file your taxes"
        ctaLabel="Create Account"
        onSubmitCta={handleCreateAccount}
        ctaLoading={isSubmitting}
        bottomText="Already have an account?"
        bottomLinkLabel="Login"
        bottomLinkHref="/(auth)/sign-in"
      >
        <TextField
          label="Full name"
          placeholder="Ada Lovelace"
          value={fullName}
          onChangeText={setFullName}
          errorMessage={fullNameError}
        />
        <TextField
          label="Email address"
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          errorMessage={emailError}
        />
        <TextField
          label="Phone number"
          placeholder="+234 800 000 0000"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          errorMessage={phoneError}
        />
        <TextField
          label="Password"
          placeholder="Create a password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          errorMessage={passwordError}
        />
        <TextField
          label="Confirm password"
          placeholder="Re-enter your password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          errorMessage={confirmPasswordError}
        />
      </AuthScreen>

      <Toast
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
    </>
  );
}
