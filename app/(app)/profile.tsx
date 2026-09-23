/**
 * Profile — the screen behind the bottom nav's "Profile" tab, which
 * previously had no screen (or route) behind it at all.
 *
 * ⚠️ PLACEHOLDER UI — there's no Figma frame for this screen. Built from
 * existing patterns/theme tokens (Card, Button, BottomSheet, the row+
 * divider list style already used on Filing History/Home) as a reasonable
 * default, not a final design. Several specific pieces have no design or
 * real backend behind them yet and are flagged inline below and in the
 * response this was built from:
 *  - The compliance badge's wording/content ("FIRS Compliant") is a
 *    placeholder — it IS wired to real data (filingHistory), just the
 *    copy/visual treatment is a guess.
 *  - Name/email and Linked Identity come from the user's Supabase profiles
 *    row. Linked Identity shows the masked NIN/BVN stored at Identity
 *    Verification (last 4 digits only — the raw numbers are never stored
 *    anywhere, and the table's check constraints reject unmasked values).
 *    The "verification" behind it is still a format-only mock.
 *  - Active Sessions is mock data (no real session backend exists).
 *  - Preferences/2FA toggles and Change Password are local-only, no real
 *    settings or auth backend.
 *  - Legal/Support items open shared placeholder content (info-page.tsx).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../state/authContext';
import { useFiling } from '../../state/filingContext';

type ModalKey = 'compliance' | 'password' | 'identity' | 'sessions' | 'signOut';

/** Stored as "*******1234" (the DB's required shape) — shown with bullets. */
function formatMaskedId(masked: string | null | undefined) {
  return masked ? masked.replace(/\*/g, '•') : 'Not provided';
}

type MockSession = {
  id: string;
  label: string;
  meta: string;
  isCurrent: boolean;
};

const INITIAL_SESSIONS: MockSession[] = [
  { id: 'this-device', label: 'This device', meta: 'Lagos, Nigeria · Active now', isCurrent: true },
  { id: 'session-2', label: 'iPhone 13', meta: 'Lagos, Nigeria · 2 days ago', isCurrent: false },
];

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function Row({
  icon,
  label,
  value,
  onPress,
  right,
  isLast,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  isLast?: boolean;
  danger?: boolean;
}) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.danger : colors.textSecondary}
          style={styles.rowIcon}
        />
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        </View>
      </View>
      {right ?? (onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      ) : null)}
    </View>
  );

  if (!onPress) {
    return content;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const isIdentityVerified = profile?.identity_verified === true;
  const { filingHistory } = useFiling();
  const isCompliant = filingHistory.length > 0;

  const [activeModal, setActiveModal] = useState<ModalKey | null>(null);
  const closeModal = () => setActiveModal(null);

  const [filingReminders, setFilingReminders] = useState(true);
  const [deadlineAlerts, setDeadlineAlerts] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [showPasswordToast, setShowPasswordToast] = useState(false);

  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [showRevokeToast, setShowRevokeToast] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const fullName = profile?.full_name?.trim() || 'FILEO User';
  const email = profile?.email || user?.email;
  const initials = getInitials(fullName);

  const goToPersonalInfo = () => router.push('/(app)/edit-profile');
  const goToInfoPage = (topic: string, title: string) =>
    router.push({ pathname: '/(app)/info-page', params: { topic, title } });

  const handleChangePassword = () => {
    if (currentPassword.length === 0 || newPassword.length === 0) {
      setPasswordError('Enter your current and new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    setPasswordError(undefined);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    closeModal();
    setShowPasswordToast(true);
  };

  const handleRevokeSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    setShowRevokeToast(true);
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    const result = await signOut();
    setIsSigningOut(false);
    closeModal();
    // On success there's nothing to navigate here: the session is gone, so
    // the (app) layout's auth guard redirects to Sign In by itself.
    if (result.error) {
      setSignOutError(result.error);
    }
  };

  return (
    <Screen style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email || 'No email on file'}</Text>

          <Pressable
            onPress={() => setActiveModal('compliance')}
            style={[
              styles.complianceBadge,
              { borderColor: isCompliant ? colors.success : colors.warning },
            ]}
            accessibilityRole="button"
          >
            <Ionicons
              name={isCompliant ? 'shield-checkmark' : 'shield-outline'}
              size={14}
              color={isCompliant ? colors.success : colors.warning}
            />
            <Text
              style={[
                styles.complianceBadgeText,
                { color: isCompliant ? colors.success : colors.warning },
              ]}
            >
              {isCompliant ? 'FIRS Compliant' : 'Not Yet Compliant'}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
          </Pressable>
        </View>

        <SectionTitle>Account</SectionTitle>
        <Card style={styles.sectionCard}>
          <Row icon="person-outline" label="Personal information" onPress={goToPersonalInfo} />
          <Row
            icon="lock-closed-outline"
            label="Change password"
            onPress={() => setActiveModal('password')}
          />
          <Row
            icon="finger-print-outline"
            label="Linked identity"
            onPress={() => setActiveModal('identity')}
            isLast
          />
        </Card>

        <SectionTitle>Preferences</SectionTitle>
        <Card style={styles.sectionCard}>
          <Row
            icon="notifications-outline"
            label="Filing reminders"
            right={
              <Switch
                value={filingReminders}
                onValueChange={setFilingReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            }
          />
          <Row
            icon="alarm-outline"
            label="Deadline alerts"
            right={
              <Switch
                value={deadlineAlerts}
                onValueChange={setDeadlineAlerts}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            }
          />
          <Row
            icon="mail-outline"
            label="Email updates"
            value="Product news and tips"
            right={
              <Switch
                value={emailUpdates}
                onValueChange={setEmailUpdates}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            }
            isLast
          />
        </Card>

        <SectionTitle>Security</SectionTitle>
        <Card style={styles.sectionCard}>
          <Row
            icon="keypad-outline"
            label="Two-factor authentication"
            right={
              <Switch
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            }
          />
          <Row
            icon="phone-portrait-outline"
            label="Active sessions"
            value={`${sessions.length} device${sessions.length === 1 ? '' : 's'}`}
            onPress={() => setActiveModal('sessions')}
            isLast
          />
        </Card>

        <SectionTitle>Legal</SectionTitle>
        <Card style={styles.sectionCard}>
          <Row
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={() => goToInfoPage('privacy', 'Privacy Policy')}
          />
          <Row
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => goToInfoPage('terms', 'Terms of Service')}
          />
          <Row
            icon="document-text-outline"
            label="How We Use Your Data"
            onPress={() => goToInfoPage('data-use', 'How We Use Your Data')}
            isLast
          />
        </Card>

        <SectionTitle>Support</SectionTitle>
        <Card style={styles.sectionCard}>
          <Row
            icon="chatbubble-ellipses-outline"
            label="Contact Us"
            onPress={() => goToInfoPage('contact', 'Contact Us')}
          />
          <Row icon="help-circle-outline" label="FAQ" onPress={() => goToInfoPage('faq', 'FAQ')} />
          <Row
            icon="flag-outline"
            label="Report a Problem"
            onPress={() => goToInfoPage('report', 'Report a Problem')}
            isLast
          />
        </Card>

        <Card style={styles.sectionCard}>
          <Row
            icon="log-out-outline"
            label="Sign out"
            onPress={() => setActiveModal('signOut')}
            danger
            isLast
          />
        </Card>
      </ScrollView>

      <BottomTabBar active="profile" />

      <BottomSheet visible={activeModal !== null} onClose={closeModal}>
        {activeModal === 'compliance' ? (
          <View>
            <Text style={styles.sheetTitle}>
              {isCompliant ? 'You&apos;re FIRS compliant' : 'Not yet compliant'}
            </Text>
            <Text style={styles.sheetBody}>
              {isCompliant
                ? 'This badge shows you’re up to date with your Nigerian tax filing obligations. It updates automatically based on your filing history.'
                : 'You haven’t completed a filing yet. Once you file your first return, this badge will update to show you’re compliant.'}
            </Text>
            <Button label="Close" variant="secondary" onPress={closeModal} />
          </View>
        ) : null}

        {activeModal === 'password' ? (
          <View>
            <Text style={styles.sheetTitle}>Change password</Text>
            <Text style={styles.sheetBody}>
              Mock only — this doesn&apos;t change a real password anywhere.
            </Text>
            <TextField
              label="Current password"
              placeholder="Enter your current password"
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
            <TextField
              label="New password"
              placeholder="Enter a new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextField
              label="Confirm new password"
              placeholder="Re-enter the new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              errorMessage={passwordError}
            />
            <Button label="Update password" variant="dark" onPress={handleChangePassword} />
          </View>
        ) : null}

        {activeModal === 'identity' ? (
          <View>
            <Text style={styles.sheetTitle}>Linked identity</Text>
            <Text style={styles.sheetBody}>
              {isIdentityVerified
                ? 'Verified during sign-up. FILEO never stores your full NIN/BVN — only the last 4 digits, so you can tell which ones were checked.'
                : 'Your NIN and BVN haven’t been verified yet.'}
            </Text>
            {[
              { label: 'NIN', masked: profile?.nin_masked },
              { label: 'BVN', masked: profile?.bvn_masked },
            ].map((item, index) => (
              <View
                key={item.label}
                style={[styles.identityRow, index === 1 && styles.identityRowLast]}
              >
                <View style={styles.identityLeft}>
                  <Text style={styles.identityLabel}>{item.label}</Text>
                  <Text style={styles.identityValue}>{formatMaskedId(item.masked)}</Text>
                </View>
                {isIdentityVerified ? (
                  <View style={styles.identityVerified}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.identityVerifiedText}>Verified</Text>
                  </View>
                ) : (
                  <Text style={styles.identityUnverifiedText}>Not verified</Text>
                )}
              </View>
            ))}
            <Button label="Close" variant="secondary" onPress={closeModal} style={styles.sheetButtonSpacing} />
          </View>
        ) : null}

        {activeModal === 'sessions' ? (
          <View>
            <Text style={styles.sheetTitle}>Active sessions</Text>
            <Text style={styles.sheetBody}>Mock data — there&apos;s no real session backend yet.</Text>
            {sessions.map((session, index) => (
              <View
                key={session.id}
                style={[
                  styles.sessionRow,
                  index < sessions.length - 1 && styles.sessionRowDivider,
                ]}
              >
                <View>
                  <Text style={styles.sessionLabel}>{session.label}</Text>
                  <Text style={styles.sessionMeta}>{session.meta}</Text>
                </View>
                {!session.isCurrent ? (
                  <Pressable onPress={() => handleRevokeSession(session.id)} hitSlop={8}>
                    <Text style={styles.revokeLink}>Revoke</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Button label="Close" variant="secondary" onPress={closeModal} style={styles.sheetButtonSpacing} />
          </View>
        ) : null}

        {activeModal === 'signOut' ? (
          <View>
            <Text style={styles.sheetTitle}>Sign out?</Text>
            <Text style={styles.sheetBody}>You&apos;ll need to sign in again to access your account.</Text>
            <Button label="Sign out" variant="dark" onPress={handleSignOut} loading={isSigningOut} />
            <Button label="Cancel" variant="ghost" onPress={closeModal} style={styles.sheetButtonSpacing} />
          </View>
        ) : null}
      </BottomSheet>

      <Toast
        visible={showPasswordToast}
        message="Password updated (mock only — nothing real changed)."
        onHide={() => setShowPasswordToast(false)}
      />
      <Toast
        visible={showRevokeToast}
        message="Session revoked."
        onHide={() => setShowRevokeToast(false)}
      />
      <Toast
        visible={signOutError !== null}
        message={signOutError ?? ''}
        onHide={() => setSignOutError(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    ...typography.h2,
    color: colors.textInverse,
  },
  name: {
    ...typography.display,
    fontSize: 22,
    color: colors.textPrimary,
  },
  email: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  complianceBadgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.bodyStrong,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
    marginRight: spacing.sm,
  },
  rowIcon: {
    width: 20,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  rowLabelDanger: {
    color: colors.danger,
  },
  rowValue: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sheetButtonSpacing: {
    marginTop: spacing.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  identityRowLast: {
    borderBottomWidth: 0,
  },
  identityLeft: {
    gap: 2,
  },
  identityLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  identityValue: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  identityVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  identityVerifiedText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  identityUnverifiedText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  sessionRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sessionLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  sessionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  revokeLink: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
});
