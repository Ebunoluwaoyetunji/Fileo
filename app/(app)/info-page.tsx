/**
 * Shared placeholder content screen for Profile's Legal and Support rows
 * (Privacy Policy, Terms of Service, How We Use Your Data, Contact Us,
 * FAQ, Report a Problem) — one file instead of six, since all six need
 * the same "simple screen with placeholder text" treatment for now.
 *
 * ⚠️ All copy here is a placeholder, clearly marked as such on-screen too
 * — real legal/support content to replace it later.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';

const PLACEHOLDER_BODY: Record<string, string> = {
  privacy:
    'This is where FILEO’s full privacy policy will go — what information we collect, how it’s used, how long it’s kept, and the choices you have over it.',
  terms:
    'This is where the terms governing your use of FILEO will go — your responsibilities, ours, and what happens if either of us doesn’t hold up our end.',
  'data-use':
    'This is where a plain-language explanation of how your filing, income, and identity information is used will go — including what’s shared with FIRS and what never leaves this app.',
  contact:
    'This is where ways to reach the FILEO team will go — support email, phone number, and hours.',
  faq: 'This is where answers to common questions about filing, deductions, documents, and your account will go.',
  report:
    'This is where you’ll be able to describe a problem you’ve run into — a form to submit details, maybe with a screenshot, will go here.',
};

const DEFAULT_TITLE = 'Information';

export default function InfoPageScreen() {
  const { topic, title } = useLocalSearchParams<{ topic?: string; title?: string }>();
  const body =
    (topic && PLACEHOLDER_BODY[topic]) ||
    'Placeholder content — real copy will go here.';

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backLabel}>Profile</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title || DEFAULT_TITLE}</Text>

        <Card style={styles.bodyCard}>
          <Text style={styles.bodyText}>{body}</Text>
        </Card>

        <View style={styles.placeholderNote}>
          <Ionicons name="construct-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.placeholderNoteText}>
            Placeholder content — will be replaced with the real copy.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  bodyCard: {
    marginBottom: spacing.md,
  },
  bodyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  placeholderNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  placeholderNoteText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
