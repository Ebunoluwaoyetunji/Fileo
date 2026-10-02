/**
 * Every info page (Privacy Policy, Terms of Use, How Fileo uses AI, Tax
 * disclaimer, Help / FAQ, About), at /info/<slug>. Outside the signed-in
 * (app) group on purpose, so Terms and Privacy open from Create Account
 * before there's an account. Copy lives in content/legal.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { LongFormPage } from '../../components/layout/LongFormPage';
import { Button } from '../../components/ui/Button';
import { FEEDBACK_URL, PORTFOLIO_URL } from '../../constants/app';
import { spacing } from '../../constants/theme';
import { INFO_PAGES, InfoPageSlug } from '../../content/legal';

export default function InfoPageScreen() {
  const { page } = useLocalSearchParams<{ page?: string }>();
  const content = page && page in INFO_PAGES ? INFO_PAGES[page as InfoPageSlug] : null;
  if (!content) {
    return <Redirect href="/" />;
  }
  return (
    <LongFormPage page={content}>
      {page === 'about' ? (
        <View style={styles.actions}>
          <Button label="Send feedback" onPress={() => Linking.openURL(FEEDBACK_URL)} />
          <Button
            label="See more of my work"
            variant="secondary"
            onPress={() => Linking.openURL(PORTFOLIO_URL)}
          />
        </View>
      ) : null}
    </LongFormPage>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm + 4,
  },
});
