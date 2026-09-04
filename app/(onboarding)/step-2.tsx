/**
 * Onboarding step 2 — Figma node 93:942 ("File in Four Simple Steps").
 * Illustration: 4 connected circles (document, checkmark, party-popper, ₦)
 * linked by dotted arcs.
 */
import { Image, StyleSheet } from 'react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { colors } from '../../constants/colors';

const illustration = require('../../assets/images/step-2-illustration.png');

function Step2Illustration() {
  return <Image source={illustration} style={styles.illustration} resizeMode="contain" />;
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
  illustration: {
    width: '100%',
    height: '100%',
  },
});
