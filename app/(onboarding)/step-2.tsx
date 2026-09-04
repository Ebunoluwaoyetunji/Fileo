/**
 * Onboarding step 2 — Figma node 93:942 ("File in Four Simple Steps").
 * Illustration is a placeholder until the exported SVG for this frame is
 * available — see the TODO below.
 */
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

// TODO: replace with the real illustration once its SVG is exported from
// Figma (4 connected circles: document, checkmark, party-popper, ₦).
function Step2Illustration() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Illustration pending</Text>
    </View>
  );
}

export default function OnboardingStepTwo() {
  return (
    <OnboardingScreen
      step={2}
      heading="File in Four Simple Steps"
      body="Follow four simple steps to complete your tax filing."
      illustration={<Step2Illustration />}
      background={{ colors: [colors.backgroundInverse] }}
      headingColor={colors.textInverse}
      bodyColor={colors.textInverse}
      activeDotColor={colors.backgroundInverse}
      nextRoute="/(onboarding)/step-3"
      prevRoute="/(onboarding)/step-1"
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
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textInverse,
    opacity: 0.7,
  },
});
