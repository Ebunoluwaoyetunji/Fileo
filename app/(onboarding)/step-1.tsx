/**
 * Onboarding step 1 — Figma node 88:663 ("File Your Taxes Without the
 * Stress"). Illustration: phone mockup showing the FILEO splash with
 * overlapping "TAX FORM" / "BANK STATEMENT" document cards.
 */
import { Image, StyleSheet } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

const illustration = require('../../assets/images/step-1-illustration.png');
const ASPECT_RATIO = 732 / 528;

function Step1Illustration() {
  return <Image source={illustration} style={styles.illustration} resizeMode="contain" />;
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
  illustration: {
    width: '100%',
    aspectRatio: ASPECT_RATIO,
  },
});
