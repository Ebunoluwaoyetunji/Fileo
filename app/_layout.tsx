/**
 * Root layout: font loading, global providers, wraps the whole app.
 *
 * The native splash stays up until fonts are loaded and the animated
 * splash (components/AnimatedSplash.tsx) is on screen over the app; the
 * animated splash hides it, plays, and fades out once the auth session has
 * loaded — revealing whichever screen index.tsx routed to.
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { AuthProvider, useAuth } from '../state/authContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Register custom fonts from assets/fonts here as they're added, e.g.
    // 'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <SplashOverlay />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** The animated splash, once per launch, until the auth session is known. */
function SplashOverlay() {
  const { isLoading } = useAuth();
  const [visible, setVisible] = useState(true);
  const handleFinish = useCallback(() => setVisible(false), []);
  if (!visible) {
    return null;
  }
  return <AnimatedSplash ready={!isLoading} onFinish={handleFinish} />;
}
