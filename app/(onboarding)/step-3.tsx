/**
 * Onboarding step 3 — Figma node 90:921 ("Your Data Is Safe"). Illustration
 * is a placeholder until the exported SVG for this frame is available —
 * see the TODO below. This is the last step: both the auto-advance/swipe
 * and the CTA button finish onboarding and land on create-account.
 */
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

// TODO: replace with the real illustration once its SVG is exported from
// Figma (file cabinet with a verified tax return + shield/fingerprint/
// face-scan/signature badges).
function Step3Illustration() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Illustration pending</Text>
    </View>
  );
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
  placeholder: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,20,23,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textSecondary,
  },
});
