/**
 * Splash screen — implements Figma node 88:612 exactly: a full-bleed
 * #0B1628 frame with only the centered FILEO wordmark on it (no other
 * copy or controls in the design). Auto-advances to onboarding step 1.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { FileoWordmark } from '../../components/ui/FileoWordmark';
import { colors } from '../../constants/colors';
import { splashLayout } from '../../constants/theme';

const SPLASH_REDIRECT_DELAY_MS = 1200;

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(onboarding)/step-1');
    }, SPLASH_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Screen edges={[]} backgroundColor={colors.backgroundInverse} style={styles.container}>
      <FileoWordmark width={splashLayout.logoWidth} height={splashLayout.logoHeight} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingTop: splashLayout.logoTop,
  },
});
