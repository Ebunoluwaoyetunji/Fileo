/**
 * Create Account — matches the Figma frame the user provided: FILEO
 * wordmark, "Create your Fileo account" heading, full name / email / phone
 * / password fields, and a "Login" link for existing users.
 *
 * Validation is presence-only (plus a password match check) — there's no
 * backend yet, so this just gates navigation, it doesn't verify anything.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';

export default function CreateAccountScreen() {
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

  const [showToast, setShowToast] = useState(false);

  const handleCreateAccount = () => {
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

    setShowToast(true);
  };

  return (
    <>
      <AuthScreen
        headingAccent="Create"
        headingRest=" your Fileo account"
        subtitle="Get started with a simpler way to file your taxes"
        ctaLabel="Create Account"
        onSubmitCta={handleCreateAccount}
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
        visible={showToast}
        message="A verification code has been sent to your email and phone number."
        onHide={() => {
          setShowToast(false);
          router.push({
            pathname: '/(auth)/otp-verification',
            params: { phone: phone.trim(), fullName: fullName.trim(), email: email.trim() },
          });
        }}
      />
    </>
  );
}
