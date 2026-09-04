/**
 * Entry/redirect logic: routes to onboarding, auth, or the app home
 * screen based on current auth/onboarding state.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../state/authContext';

export default function Index() {
  const { isAuthenticated, hasCompletedOnboarding } = useAuth();

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(onboarding)/splash" />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Redirect href="/(app)/home" />;
}
