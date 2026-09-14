/**
 * Edit personal information — reached from Profile's "Personal
 * information" row. Local-only: updateUser() just merges these fields
 * into AuthContext's in-memory user, no real backend persists them.
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
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [fullNameError, setFullNameError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [showToast, setShowToast] = useState(false);

  const handleSave = () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const nextFullNameError = trimmedName.length === 0 ? 'Enter your full name.' : undefined;
    const nextEmailError = trimmedEmail.length === 0 ? 'Enter your email address.' : undefined;

    setFullNameError(nextFullNameError);
    setEmailError(nextEmailError);
    if (nextFullNameError || nextEmailError) {
      return;
    }

    updateUser({
      fullName: trimmedName,
      email: trimmedEmail,
      phone: phone.trim() || undefined,
    });
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
        <Text style={styles.subtitle}>Local only for now — nothing here is saved to a server.</Text>

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
        />

        <Button label="Save changes" variant="dark" onPress={handleSave} style={styles.saveButton} />
      </ScrollView>

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
