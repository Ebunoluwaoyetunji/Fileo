/**
 * Edit personal information — reached from Profile's "Personal
 * information" row. Saves full name and phone to the user's Supabase
 * profiles row.
 *
 * Email is shown read-only: the login email lives in Supabase Auth, and
 * changing it properly means Supabase's email-change flow (a confirmation
 * sent to the new address) — editing just the profiles copy would leave
 * the two out of sync. Not built yet.
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
  const { user, profile, updateProfile } = useAuth();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    const trimmedName = fullName.trim();
    const nextFullNameError = trimmedName.length === 0 ? 'Enter your full name.' : undefined;
    setFullNameError(nextFullNameError);
    if (nextFullNameError) {
      return;
    }

    setIsSaving(true);
    const result = await updateProfile({ full_name: trimmedName, phone: phone.trim() || null });
    setIsSaving(false);
    if (result.error) {
      setSaveError(result.error);
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
        <Text style={styles.subtitle}>Email can&apos;t be changed here yet.</Text>

        <TextField
          label="Full name"
          placeholder="Ada Lovelace"
          value={fullName}
          onChangeText={setFullName}
          errorMessage={fullNameError}
        />
        <TextField
          label="Email address"
          value={profile?.email ?? user?.email ?? ''}
          editable={false}
          style={styles.readOnlyInput}
        />
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

      <Toast
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
  readOnlyInput: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
  },
});
