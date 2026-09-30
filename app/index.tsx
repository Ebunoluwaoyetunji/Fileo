/**
 * Entry/redirect logic: routes to onboarding, auth, identity verification,
 * or the app home screen based on the real Supabase session + profile.
 * Sign In and OTP Verification both land back here after success, so this
 * is the one place that decides where a signed-in user goes.
 */
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { useAuth } from '../state/authContext';

export default function Index() {
  const { isLoading, session, profile, hasCompletedOnboarding } = useAuth();

  // Restoring a persisted session / loading the profile row — don't route
  // on incomplete information (that would flash the sign-in screen at a
  // user who's actually still signed in).
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (session) {
    // Verified their email but never finished Identity Verification (e.g.
    // closed the app on that screen) — resume there rather than skip it.
    if (profile && !profile.identity_verified) {
      return <Redirect href="/(auth)/identity-verification" />;
    }
    // Checked before onboarding on purpose: the onboarding flag is
    // in-memory only, so a restored session (app reopened) would otherwise
    // be sent back through the carousel.
    return <Redirect href="/(app)/home" />;
  }

  if (!hasCompletedOnboarding) {
    // The animated splash (components/AnimatedSplash) has just played, so
    // first-time users go straight to the first onboarding screen.
    return <Redirect href="/(onboarding)/step-1" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
