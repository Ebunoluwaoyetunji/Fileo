/**
 * Onboarding step 2: how filing works, as a short vertical step list on navy
 * (OnboardingSteps). The rows animate in on every visit; the screens remount
 * on each swipe, so the entrance replays when the user comes back.
 */
import { CircleCheck, FileUp, Percent, Wallet } from 'lucide-react-native';
import { OnboardingScreen } from '../../components/layout/OnboardingScreen';
import { OnboardingSteps, type OnboardingStep } from '../../components/ui/OnboardingSteps';
import { colors } from '../../constants/colors';

const steps: OnboardingStep[] = [
  { key: 'income', icon: Wallet, title: 'Add your income sources', detail: 'Paystack, Upwork, your bank' },
  { key: 'upload', icon: FileUp, title: 'Upload your statements', detail: 'Fileo reads them for you' },
  { key: 'deductions', icon: Percent, title: 'Claim your deductions', detail: 'Pension, NHF and more' },
  { key: 'submit', icon: CircleCheck, title: 'Review and submit', detail: 'See what you owe, and why' },
];

export default function OnboardingStep2() {
  return (
    <OnboardingScreen
      step={2}
      heading="Your return, step by step"
      body="Fileo guides you from your first statement to a finished return."
      illustration={<OnboardingSteps steps={steps} />}
      background={{ colors: [colors.backgroundInverse] }}
      headingColor={colors.textInverse}
      bodyColor={colors.textInverse}
      activeDotColor={colors.backgroundInverse}
      nextRoute="/(onboarding)/step-3"
      prevRoute="/(onboarding)/step-1"
    />
  );
}
