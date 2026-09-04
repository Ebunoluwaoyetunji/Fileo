import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="create-account" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="identity-verification" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
