/**
 * Layout for the authenticated part of the app. Wraps every screen in
 * FilingProvider so filing state (platforms, income, deductions) persists
 * across the whole (app) group and resets when the flow is left.
 *
 * Also the auth guard for this group: with no Supabase session (signed
 * out, session expired and couldn't refresh, or a direct web link to e.g.
 * /home), every (app) screen redirects to Sign In. That's also what moves
 * the user off Profile after "Sign out".
 */
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../state/authContext';
import { FilingProvider } from '../../state/filingContext';

export default function AppLayout() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <FilingProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="verify-email-change" />
        <Stack.Screen name="info-page" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="filing-history" />
        <Stack.Screen name="filing-detail" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="document-detail" />
        <Stack.Screen name="select-platform" />
        <Stack.Screen name="select-bank" />
        <Stack.Screen name="upload-documents" />
        <Stack.Screen name="income-summary" />
        <Stack.Screen name="deductions" />
        <Stack.Screen name="return-review" />
        <Stack.Screen name="confirmation" />
        <Stack.Screen name="ai-consent" options={{ presentation: 'modal' }} />
        <Stack.Screen name="statement-breakdown" />
      </Stack>
    </FilingProvider>
  );
}
