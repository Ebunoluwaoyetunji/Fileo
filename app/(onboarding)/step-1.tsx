/**
 * Onboarding step 1 — Figma node 88:663 ("File Your Taxes Without the
 * Stress"). Illustration is a placeholder until the exported SVG for this
 * frame is available — see the TODO below.
 */
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

// TODO: replace with the real illustration once its SVG is exported from
// Figma (phone mockup + "TAX FORM" / "BANK STATEMENT" document cards).
function Step1Illustration() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Illustration pending</Text>
    </View>
  );
}

export default function OnboardingStepOne() {
  return (
    <OnboardingScreen
      step={1}
      heading="File Your Taxes Without the Stress"
      body="Prepare and file your tax return in minutes. Fileo handles the hard work, so you don't have to."
      illustration={<Step1Illustration />}
      background={{ colors: [colors.forestDeep, colors.background] }}
      headingColor={colors.textPrimary}
      bodyColor={colors.textInverse}
      activeDotColor={colors.primary}
      nextRoute="/(onboarding)/step-2"
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
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.textInverse,
    opacity: 0.7,
  },
});
