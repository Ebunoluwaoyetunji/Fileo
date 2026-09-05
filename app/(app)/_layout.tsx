/**
 * Layout for the authenticated filing flow. Wraps every screen in
 * FilingProvider so filing state (platforms, income, deductions) persists
 * across the whole (app) group and resets when the flow is left.
 */
import { Stack } from 'expo-router';
import { FilingProvider } from '../../state/filingContext';

export default function AppLayout() {
  return (
    <FilingProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="home" />
        <Stack.Screen name="filing-history" />
        <Stack.Screen name="select-platform" />
        <Stack.Screen name="select-bank" />
        <Stack.Screen name="upload-documents" />
        <Stack.Screen name="income-summary" />
        <Stack.Screen name="deductions" />
        <Stack.Screen name="return-review" />
        <Stack.Screen name="confirmation" />
      </Stack>
    </FilingProvider>
  );
}
