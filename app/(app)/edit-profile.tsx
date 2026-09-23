/**
 * Edit personal information — reached from Profile's "Personal
 * information" row. Saves full name and phone to the user's Supabase
 * profiles row.
 *
 * Email goes through Supabase's email-change flow instead. Changing it asks
 * for the current password (checked the same way as Change Password); only
 * when that's right does updateUser() email a code to the new address,
 * entered on the shared OTP screen (via (app)/verify-email-change). The
 * login email changes once the code is confirmed, and a database trigger
 * then copies it into profiles.email — the app can't write that column.
 *
 * ⚠️ PLACEHOLDER UI — no Figma frame for this screen either.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';

export default function EditProfileScreen() {
  const { user, profile, updateProfile, requestEmailChange } = useAuth();
  // The login email (Supabase Auth) is the source of truth; profiles.email
  // is kept in sync with it by a database trigger.
  const currentEmail = user?.email ?? profile?.email ?? '';

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const trimmedEmail = email.trim();
  const isEmailChanged = trimmedEmail.toLowerCase() !== currentEmail.toLowerCase();

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const nextFullNameError = trimmedName.length === 0 ? 'Enter your full name.' : undefined;
    const nextEmailError =
      trimmedEmail.length === 0
        ? 'Enter your email address.'
        : !/^\S+@\S+\.\S+$/.test(trimmedEmail)
          ? 'Enter a valid email address.'
          : undefined;
    const nextPasswordError =
      isEmailChanged && currentPassword.length === 0
        ? 'Enter your current password to change your email.'
        : undefined;
    setFullNameError(nextFullNameError);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    if (nextFullNameError || nextEmailError || nextPasswordError) {
      return;
    }

    setIsSaving(true);

    // Email first: nothing is saved and no code is sent if the password is
    // wrong or the new address can't be used.
    if (isEmailChanged) {
      const emailResult = await requestEmailChange(trimmedEmail, currentPassword);
      if (emailResult.error) {
        setIsSaving(false);
        if (emailResult.code === 'current_password_invalid') {
          setPasswordError(emailResult.error);
        } else if (emailResult.code === 'email_exists' || emailResult.code === 'email_address_invalid') {
          setEmailError(emailResult.error);
        } else {
          setSaveError(emailResult.error);
        }
        return;
      }
    }

    const isNameOrPhoneChanged =
      trimmedName !== (profile?.full_name ?? '') || trimmedPhone !== (profile?.phone ?? '');
    if (isNameOrPhoneChanged) {
      const result = await updateProfile({ full_name: trimmedName, phone: trimmedPhone || null });
      if (result.error) {
        setIsSaving(false);
        setSaveError(result.error);
        return;
      }
    }

    setIsSaving(false);
    if (isEmailChanged) {
      setCurrentPassword('');
      router.push({
        pathname: '/(app)/verify-email-change',
        params: { purpose: 'email_change', newEmail: trimmedEmail },
      });
      return;
    }
    setShowToast(true);
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backLabel}>Profile</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Personal information</Text>
        <Text style={styles.subtitle}>
          To change your email, you&apos;ll need your current password and a code we send to the
          new address.
        </Text>

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
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          errorMessage={emailError}
        />
        {isEmailChanged ? (
          <TextField
            label="Current password"
            placeholder="Enter your current password"
            secureTextEntry
            autoComplete="current-password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            errorMessage={passwordError}
          />
        ) : null}
        <TextField
          label="Phone number"
          placeholder="+234 800 000 0000"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <Button
          label="Save changes"
          variant="dark"
          onPress={handleSave}
          loading={isSaving}
          style={styles.saveButton}
        />
      </ScrollView>

      {/* Keyed by message: a second error arriving while the first is still
          showing gets its own full timer, instead of being cleared early by
          the first toast's hide. */}
      <Toast
        key={saveError ?? 'none'}
        visible={saveError !== null}
        message={saveError ?? ''}
        onHide={() => setSaveError(null)}
      />
      <Toast
        visible={showToast}
        message="Profile updated."
        onHide={() => {
          setShowToast(false);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
