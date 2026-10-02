/**
 * AI reading consent — shown before the first statement is read (from the
 * filing flow, when the user hasn't decided yet). Plain English: what's
 * sent, to whom, why, that the user always confirms the numbers, and that
 * they can type their income instead. "Allow" or "Enter manually"; either
 * choice is saved on their profile (set_ai_consent) and can be changed in
 * Profile at any time. A link under the points opens the full "How Fileo
 * uses AI" page (content/legal/ai.ts).
 *
 * ⚠️ No Figma design for this screen — built from the existing Screen,
 * Card, Button and text styles.
 */
import { Building2, ChevronRight, CircleCheck, FileText, type LucideIcon, Sparkles, SquarePen } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { infoPageHref } from '../../content/legal';
import { setAiConsent } from '../../lib/extractions';
import { useAuth } from '../../state/authContext';

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: FileText,
    title: 'What we send',
    body: 'Only the statements you upload for your return: bank, wallet and platform statements. Your receipts and other documents are never sent.',
  },
  {
    icon: Building2,
    title: 'Who reads them',
    body: 'Anthropic, the company that makes the Claude AI, reads each statement for us and sends back the payments it finds. Anthropic doesn’t use your statements to train its AI.',
  },
  {
    icon: Sparkles,
    title: 'Why',
    body: 'To find the money you received and suggest your income for the year, so you don’t have to add it all up yourself.',
  },
  {
    icon: CircleCheck,
    title: 'You stay in control',
    body: 'You always check and confirm the numbers before anything is filed. If we’re not sure about a payment, we’ll ask you.',
  },
  {
    icon: SquarePen,
    title: 'Prefer not to?',
    body: 'Choose “Enter manually” and type your income yourself. You can change your mind at any time in Profile.',
  },
];

export default function AiConsentScreen() {
  const { refreshProfile } = useAuth();
  const [saving, setSaving] = useState<'allow' | 'manual' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (allow: boolean) => {
    if (saving) {
      return;
    }
    setSaving(allow ? 'allow' : 'manual');
    setError(null);
    const result = await setAiConsent(allow);
    if (result.error) {
      setSaving(null);
      setError('Couldn’t save your choice. Check your connection and try again.');
      return;
    }
    await refreshProfile();
    setSaving(null);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(app)/home');
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Let Fileo read your statements?</Text>
        <Text style={styles.subtitle}>
          We can read the statements you upload and suggest your income, so filing is quicker.
        </Text>
        <Card style={styles.card}>
          {POINTS.map((point) => (
            <View key={point.title} style={styles.point}>
              <point.icon size={24} color={colors.primary} />
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{point.title}</Text>
                <Text style={styles.pointBody}>{point.body}</Text>
              </View>
            </View>
          ))}
        </Card>
        <Pressable
          onPress={() => router.push(infoPageHref('ai'))}
          style={({ pressed }) => [styles.moreLink, pressed && styles.pressed]}
          accessibilityRole="link"
          hitSlop={4}
        >
          <Text style={styles.moreLinkText}>How Fileo uses AI</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Allow" onPress={() => choose(true)} loading={saving === 'allow'} />
      <Button
        label="Enter manually"
        variant="secondary"
        onPress={() => choose(false)}
        loading={saving === 'manual'}
        style={styles.secondButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  pointBody: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  moreLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 44,
    marginTop: spacing.sm,
  },
  moreLinkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  secondButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});
