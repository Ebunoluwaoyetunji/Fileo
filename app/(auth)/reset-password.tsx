/**
 * Reset Password — last step of Forgot Password, after the recovery code
 * has been accepted on OTP Verification (which signed the user in with a
 * recovery session).
 *
 * ⚠️ NO FIGMA FRAME YET — built from the shared AuthScreen layout to match
 * Create Account / Sign In, as a placeholder until it's designed.
 *
 * Saving the password makes Supabase sign out every other session; this
 * device stays signed in. It then hands off to app/index.tsx, which goes
 * to Home (or Identity Verification, for an account that never finished
 * it) — the user just proved they own the inbox, so sending them back to
 * Sign In to type the new password again would add nothing.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { AuthScreen } from '../../components/layout/AuthScreen';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { useAuth } from '../../state/authContext';

export default function ResetPasswordScreen() {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSave = async () => {
    if (isSaving || isDone) {
      return;
    }
    const nextPasswordError = password.length === 0 ? 'Enter a new password.' : undefined;
    const nextConfirmError =
      confirmPassword.length === 0
        ? 'Confirm your new password.'
        : confirmPassword !== password
          ? 'Passwords do not match.'
          : undefined;
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmError);
    if (nextPasswordError || nextConfirmError) {
      return;
    }

    setIsSaving(true);
    const result = await setNewPassword(password);
    setIsSaving(false);
    if (result.error) {
      // Weak / same-as-old password messages come from Supabase and belong
      // on the password field; a lost session means starting over.
      setPasswordError(result.error);
      return;
    }
    setIsDone(true);
  };

  return (
    <>
      <AuthScreen
        headingAccent="Set a new password"
        subtitle="Choose a new password for your Fileo account."
        subtitleColor={colors.textPrimary}
        ctaLabel="Save password"
        onSubmitCta={handleSave}
        ctaLoading={isSaving}
        bottomText="Changed your mind?"
        bottomLinkLabel="Back to sign in"
        bottomLinkHref="/(auth)/sign-in"
      >
        <TextField
          label="New password"
          placeholder="Create a new password"
          secureTextEntry
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          errorMessage={passwordError}
        />
        <TextField
          label="Confirm new password"
          placeholder="Re-enter your new password"
          secureTextEntry
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          errorMessage={confirmPasswordError}
        />
      </AuthScreen>

      <Toast
        visible={isDone}
        message="Password updated. You've been signed out on other devices."
        onHide={() => router.replace('/')}
      />
    </>
  );
}
