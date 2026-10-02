/**
 * The one layout for long-form info pages (Privacy, Terms, How Fileo uses
 * AI, Tax disclaimer, Help / FAQ, About): a back arrow, the title, "Last
 * updated", the early-testing note when the page asks for it, a short
 * intro, then sections with headings, paragraphs, bullets and link rows,
 * and (for the FAQ) expandable question rows. `children` go at the end
 * (About's buttons).
 *
 * Copy comes from content/legal; nothing here holds page text. Text wraps
 * freely and nothing has a fixed height, so it reads at larger text sizes.
 */
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react-native';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from './Screen';
import { TestingNotice } from '../ui/TestingNotice';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { Block, InfoPage, infoPageHref } from '../../content/legal';

/** Back to wherever the page was opened from, or the start if it was opened directly. */
function goBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

function BlockView({ block }: { block: Block }) {
  if (typeof block === 'string') {
    return <Text style={styles.paragraph}>{block}</Text>;
  }
  if ('bullets' in block) {
    return (
      <View style={styles.bullets}>
        {block.bullets.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.links}>
      {block.links.map((link) => (
        <Pressable
          key={link.label}
          onPress={() => (link.page ? router.push(infoPageHref(link.page)) : link.url && Linking.openURL(link.url))}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          accessibilityRole="link"
          hitSlop={4}
        >
          <Text style={styles.linkText}>{link.label}</Text>
          {link.url ? <ExternalLink size={16} color={colors.primary} /> : <ChevronRight size={16} color={colors.primary} />}
        </Pressable>
      ))}
    </View>
  );
}

function QuestionRow({ question, answer, first }: { question: string; answer: Block[]; first: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.question, !first && styles.divider]}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((value) => !value);
        }}
        style={({ pressed }) => [styles.questionRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.questionText}>{question}</Text>
        <View style={open && styles.chevronOpen}>
          <ChevronDown size={20} color={colors.textSecondary} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.answer}>
          {answer.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LongFormPage({ page, children }: { page: InfoPage; children?: ReactNode }) {
  return (
    <Screen>
      <Pressable onPress={goBack} style={styles.backRow} hitSlop={8} accessibilityRole="button">
        <ChevronLeft color={colors.textPrimary} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          {page.title}
        </Text>
        {page.lastUpdated ? <Text style={styles.updated}>Last updated {page.lastUpdated}</Text> : null}
        {page.testingNotice ? <TestingNotice variant="card" style={styles.notice} /> : null}
        <Text style={styles.intro}>{page.intro}</Text>

        {page.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {section.heading}
            </Text>
            {section.body.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </View>
        ))}

        {page.questions ? (
          <View style={styles.questions}>
            {page.questions.map((q, i) => (
              <QuestionRow key={q.question} question={q.question} answer={q.answer} first={i === 0} />
            ))}
          </View>
        ) : null}

        {children}
      </ScrollView>
    </Screen>
  );
}

const READING = { fontSize: 16, lineHeight: 24 } as const;

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  updated: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  notice: {
    marginTop: spacing.md,
  },
  intro: {
    ...typography.body,
    ...READING,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
  },
  heading: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    ...READING,
    color: colors.textPrimary,
    marginBottom: spacing.sm + 4,
  },
  bullets: {
    gap: spacing.sm,
    marginBottom: spacing.sm + 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 9,
  },
  bulletText: {
    ...typography.body,
    ...READING,
    color: colors.textPrimary,
    flex: 1,
  },
  links: {
    marginBottom: spacing.sm,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: 44,
  },
  linkText: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  questions: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
  },
  question: {
    paddingVertical: spacing.xs,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  questionText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  answer: {
    paddingBottom: spacing.sm,
  },
});
