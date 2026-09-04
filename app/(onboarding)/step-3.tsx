/**
 * Onboarding step 3 — Figma node 90:921 ("Your Data Is Safe"). Illustration:
 * file cabinet with a verified tax return folder + shield/fingerprint/
 * face-scan/signature badges. This is the last step: both the
 * auto-advance/swipe and the CTA button finish onboarding and land on
 * create-account.
 */
import { Image, StyleSheet } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

const illustration = require('../../assets/images/step-3-illustration.png');
const ASPECT_RATIO = 776 / 562;

function Step3Illustration() {
  return <Image source={illustration} style={styles.illustration} resizeMode="contain" />;
}

export default function OnboardingStepThree() {
  return (
    <OnboardingScreen
      step={3}
      heading="Your Data Is Safe"
      body="Your data is encrypted and protected every step of the way."
      illustration={<Step3Illustration />}
      background={{ colors: [colors.goldSoft, colors.background] }}
      headingColor={colors.textPrimary}
      bodyColor={colors.textSecondary}
      activeDotColor={colors.warning}
      prevRoute="/(onboarding)/step-2"
    />
  );
}

const styles = StyleSheet.create({
  illustration: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
  },
});
