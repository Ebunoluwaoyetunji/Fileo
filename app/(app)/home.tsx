/**
 * Home: one filing card that says the single next step, then the numbers
 * so far, short explainers, and past years. Top to bottom:
 *
 *  1. Header: initials avatar (opens Profile), the bell, and a greeting.
 *  2. Filing card, on the tinted hero: "2025 TAX RETURN", the next step as
 *     the title, a SegmentedRing (one segment per filing step), the
 *     deadline pill (constants/deadlines.ts) and one button. States:
 *       not started   0/5, "Start your 2025 return", Start filing
 *       in progress   n/5, the next step ("Upload your Upwork statement"),
 *                     Continue (resumes the draft at its saved step)
 *       submitted     ring full, "Your return is being processed", View status
 *       completed     ring full with a tick, "You're done for 2025", View receipt
 *       rejected      ring full in amber, "Your return needs attention"
 *     plus loading and couldn't-load.
 *  3. Estimated tax: only once the draft has income and a calculation. Taps
 *     through to Return Review.
 *  4. Helpful to know: a swipeable row of explainer cards, each opening a
 *     short sheet (components/filing/HelpSheets).
 *  5. Past years: every other submitted return, one compact row each.
 *
 * Display only: which step is next, and what "Continue" does, come from the
 * saved draft and useStartFiling, the same as the File tab. Nothing here
 * logs names, amounts or other personal data.
 *
 * ⚠️ The bell has no unread dot: nothing in the app creates notifications
 * yet (see notifications.tsx), so there's nothing to count.
 */
import {
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  Layers,
  LucideIcon,
  ReceiptText,
  Wallet,
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { HeroScroll } from '../../components/layout/HeroScroll';
import { Screen } from '../../components/layout/Screen';
import { useStartFiling } from '../../components/filing/FilingFlow';
import {
  DeadlineHelpSheet,
  DeductionsHelpSheet,
  effectiveRate,
  IncomeHelpSheet,
  TaxBandsSheet,
} from '../../components/filing/HelpSheets';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { SegmentedRing } from '../../components/ui/SegmentedRing';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { daysUntil, filingDeadline, formatDeadline, formatDeadlineLong } from '../../constants/deadlines';
import { platformDocumentLabel } from '../../constants/platforms';
import { layout, radii, spacing, tabularNumbers, typography } from '../../constants/theme';
import {
  currentTaxYear,
  Filing,
  FILING_STEPS,
  getTaxRules,
  STATUS_LABELS,
  stepIndex,
  taxSavedKobo,
} from '../../lib/filings';
import { formatNaira } from '../../lib/money';
import { useAuth } from '../../state/authContext';
import { FilingHistoryEntry, useFiling } from '../../state/filingContext';

const TOTAL_STEPS = FILING_STEPS.length;
const LEARN_CARD_WIDTH = 200;

type CardState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'notStarted'; taxYear: number }
  | { kind: 'inProgress'; taxYear: number; done: number; title: string }
  | { kind: 'submitted' | 'completed' | 'rejected'; taxYear: number; entry: FilingHistoryEntry };

type LearnKey = 'bands' | 'income' | 'deductions' | 'deadline';

function timeGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Ebun Oyetunji" -> "EO", "Ebun" -> "E". */
function initials(fullName: string | null | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((word) => word.charAt(0).toUpperCase()).join('');
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The draft's next step in plain words, from where it was last saved. */
function nextStepTitle(draft: Filing): string {
  switch (draft.currentStep) {
    case 'upload_documents': {
      const missing = draft.platforms.find((platform) => !draft.documentIdsByKey[platform]);
      return missing ? `Upload your ${platformDocumentLabel(missing)}` : 'Upload your documents';
    }
    case 'income_summary':
      return 'Confirm your income';
    case 'deductions':
      return 'Add your deductions';
    case 'return_review':
      return 'Review and submit';
    case 'select_platform':
    default:
      return 'Choose where you earn';
  }
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const { isLoading, loadError, reload, draft, filingHistory } = useFiling();
  const { start: goToFiling, isStarting, error: startError, clearError } = useStartFiling();
  const [retrying, setRetrying] = useState(false);
  const [learn, setLearn] = useState<LearnKey | null>(null);
  const [now] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // ─── What the filing card shows ─────────────────────────────────────────
  const thisYearEntry = draft ? undefined : filingHistory.find((entry) => entry.taxYear === currentTaxYear(now));
  let card: CardState;
  if (isLoading) {
    card = { kind: 'loading' };
  } else if (loadError) {
    card = { kind: 'error', message: loadError };
  } else if (draft) {
    const done = stepIndex(draft.currentStep);
    card = done <= 0
      ? { kind: 'notStarted', taxYear: draft.taxYear }
      : { kind: 'inProgress', taxYear: draft.taxYear, done, title: nextStepTitle(draft) };
  } else if (thisYearEntry) {
    const kind =
      thisYearEntry.status === 'completed'
        ? 'completed'
        : thisYearEntry.status === 'rejected'
          ? 'rejected'
          : 'submitted';
    card = { kind, taxYear: thisYearEntry.taxYear, entry: thisYearEntry };
  } else {
    card = { kind: 'notStarted', taxYear: currentTaxYear(now) };
  }
  const cardYear = 'taxYear' in card ? card.taxYear : currentTaxYear(now);

  const calc = draft && draft.totalIncomeKobo > 0 ? draft.taxCalculation : null;
  const pastYears = filingHistory.filter((entry) => entry !== thisYearEntry);

  // The year's bands and deductions, for the explainers (loaded when first opened).
  const [rules, setRules] = useState<Awaited<ReturnType<typeof getTaxRules>> | undefined>(undefined);
  const needsRules = (learn === 'bands' && !calc) || learn === 'deductions';
  useEffect(() => {
    if (!needsRules || rules !== undefined) {
      return;
    }
    let cancelled = false;
    getTaxRules(cardYear).then((result) => {
      if (!cancelled) {
        setRules(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [needsRules, rules, cardYear]);

  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${timeGreeting(now.getHours())}, ${firstName}` : timeGreeting(now.getHours());
  const avatarText = initials(profile?.full_name);

  const openFiling = (entry: FilingHistoryEntry) =>
    router.push({ pathname: '/(app)/filing-detail', params: { id: entry.id } });

  const deadline = filingDeadline(cardYear);

  const hero = (
    <>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Profile"
          hitSlop={4}
        >
          <Text style={styles.avatarText} maxFontSizeMultiplier={1.4}>
            {avatarText}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={4}
        >
          <Bell size={24} />
        </Pressable>
      </View>
      <Text style={styles.greeting} accessibilityRole="header">
        {greeting}
      </Text>

      <FilingCard
        card={card}
        deadline={deadline}
        now={now}
        isStarting={isStarting}
        retrying={retrying}
        onStart={goToFiling}
        onOpenFiling={openFiling}
        onRetry={retry}
      />
    </>
  );

  const learnCards: { key: LearnKey; icon: LucideIcon; title: string; line: string }[] = [
    { key: 'bands', icon: Layers, title: 'How tax bands work', line: 'Why your rate is lower than it looks' },
    { key: 'income', icon: Wallet, title: 'What counts as income', line: 'And what you can leave out' },
    { key: 'deductions', icon: ReceiptText, title: 'Deductions you can claim', line: 'Lower the income you’re taxed on' },
    {
      key: 'deadline',
      icon: CalendarClock,
      title: 'When your return is due',
      line: deadline ? `By ${formatDeadlineLong(deadline)}` : 'Dates, and filing late',
    },
  ];

  return (
    <Screen style={styles.screen} edges={['top']} backgroundColor={colors.heroTint}>
      <HeroScroll screenPadded={false} hero={hero} heroStyle={styles.hero} sheetStyle={styles.sheet}>
        {calc ? (
          <Pressable
            onPress={() => router.push('/(app)/return-review')}
            style={({ pressed }) => [styles.snapshot, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Estimated tax ${formatNaira(calc.taxDueKobo)}. Deductions saved you ${formatNaira(taxSavedKobo(calc))}. Effective rate ${effectiveRate(calc)}.`}
            accessibilityHint="Opens your return review"
          >
            <View style={styles.snapshotTop}>
              <Text style={styles.overline}>Estimated tax</Text>
              <ChevronRight size={20} color={colors.textSecondary} />
            </View>
            <Text style={styles.snapshotAmount} adjustsFontSizeToFit numberOfLines={1}>
              {formatNaira(calc.taxDueKobo)}
            </Text>
            <Text style={styles.muted}>Based on your income so far</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Deductions saved you</Text>
                <Text style={[styles.statValue, styles.statValueGood]}>{formatNaira(taxSavedKobo(calc))}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Effective rate</Text>
                <Text style={styles.statValue}>{effectiveRate(calc)}</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        <Text style={[styles.overline, styles.sectionLabel]}>Helpful to know</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={LEARN_CARD_WIDTH + spacing.sm + 4}
          decelerationRate="fast"
          style={styles.learnScroll}
          contentContainerStyle={styles.learnRow}
        >
          {learnCards.map(({ key, icon: Icon, title, line }) => (
            <Pressable
              key={key}
              onPress={() => setLearn(key)}
              style={({ pressed }) => [styles.learnCard, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${line}`}
            >
              <View style={styles.learnIcon}>
                <Icon size={20} color={colors.primary} />
              </View>
              <Text style={styles.learnTitle}>{title}</Text>
              <Text style={styles.learnLine}>{line}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {pastYears.length > 0 ? (
          <>
            <Text style={[styles.overline, styles.sectionLabel]}>Past years</Text>
            <View style={styles.pastList}>
              {pastYears.map((entry, index) => (
                <Pressable
                  key={entry.id}
                  onPress={() => openFiling(entry)}
                  style={({ pressed }) => [styles.pastRow, index > 0 && styles.divider, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.taxYear} tax return, ${STATUS_LABELS[entry.status]}`}
                >
                  <Text style={styles.pastText}>
                    <Text style={styles.pastYear}>{entry.taxYear}</Text>
                    <Text style={styles.pastStatus}> · {STATUS_LABELS[entry.status]}</Text>
                  </Text>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </HeroScroll>

      <BottomTabBar active="home" />

      <BottomSheet visible={learn !== null} onClose={() => setLearn(null)}>
        {learn === 'bands' ? (
          <TaxBandsSheet
            taxYear={calc?.taxYear ?? cardYear}
            bands={calc ? calc.bands : rules?.bands ?? null}
            calc={calc}
            onClose={() => setLearn(null)}
          />
        ) : learn === 'income' ? (
          <IncomeHelpSheet taxYear={cardYear} onClose={() => setLearn(null)} />
        ) : learn === 'deductions' ? (
          <DeductionsHelpSheet
            taxYear={cardYear}
            reliefs={rules?.reliefs ?? null}
            hasConsolidatedRelief={rules?.hasConsolidatedRelief ?? false}
            onClose={() => setLearn(null)}
          />
        ) : learn === 'deadline' ? (
          <DeadlineHelpSheet taxYear={cardYear} onClose={() => setLearn(null)} />
        ) : null}
      </BottomSheet>

      <Toast
        key={startError ?? 'none'}
        visible={startError !== null}
        message={startError ?? ''}
        onHide={clearError}
      />
    </Screen>
  );
}

// ─── Filing card ─────────────────────────────────────────────────────────────
function FilingCard({
  card,
  deadline,
  now,
  isStarting,
  retrying,
  onStart,
  onOpenFiling,
  onRetry,
}: {
  card: CardState;
  deadline: Date | null;
  now: Date;
  isStarting: boolean;
  retrying: boolean;
  onStart: () => void;
  onOpenFiling: (entry: FilingHistoryEntry) => void;
  onRetry: () => void;
}) {
  // Narrow phones and larger text: a smaller ring and title, so a long word
  // ("deductions") never has to break beside the ring.
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.2;
  const ring = compact ? { size: 64, strokeWidth: 6, gap: 5 } : { size: 84, strokeWidth: 7, gap: 6 };
  const titleStyle = [styles.cardTitle, compact && styles.cardTitleCompact];

  if (card.kind === 'loading') {
    return (
      <View style={styles.card} accessible accessibilityLabel="Loading your return">
        <View style={styles.cardTop}>
          <View style={styles.cardText}>
            <View style={[styles.skeleton, styles.skeletonLabel]} />
            <View style={[styles.skeleton, styles.skeletonTitle]} />
            <View style={[styles.skeleton, styles.skeletonTitleShort]} />
          </View>
          <SegmentedRing total={TOTAL_STEPS} completed={0} {...ring} />
        </View>
        <View style={[styles.skeleton, styles.skeletonButton]} />
      </View>
    );
  }

  if (card.kind === 'error') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{currentTaxYear(now)} tax return</Text>
        <Text style={titleStyle}>Couldn’t load your return</Text>
        <Text style={[styles.muted, styles.errorBody]} accessibilityLiveRegion="polite">
          {/* The title already says it didn't load; the body says what to do. */}
          {card.message.includes('connection') ? 'Check your connection and try again.' : 'Please try again.'}
        </Text>
        <Button label="Try again" variant="secondary" onPress={onRetry} loading={retrying} style={styles.cardButton} />
      </View>
    );
  }

  const year = card.taxYear;
  let title: string;
  let done: number;
  let centre: ReactNode;
  let ringColor: string = colors.primary;
  let button: { label: string; onPress: () => void; loading?: boolean };
  switch (card.kind) {
    case 'notStarted':
      title = `Start your ${year} return`;
      done = 0;
      button = { label: 'Start filing', onPress: onStart, loading: isStarting };
      break;
    case 'inProgress':
      title = card.title;
      done = card.done;
      button = { label: 'Continue', onPress: onStart, loading: isStarting };
      break;
    case 'submitted':
      title = 'Your return is being processed';
      done = TOTAL_STEPS;
      button = { label: 'View status', onPress: () => onOpenFiling(card.entry) };
      break;
    case 'completed':
      title = `You’re done for ${year}`;
      done = TOTAL_STEPS;
      centre = <Check size={compact ? 24 : 32} color={colors.primary} />;
      button = { label: 'View receipt', onPress: () => onOpenFiling(card.entry) };
      break;
    case 'rejected':
    default:
      title = 'Your return needs attention';
      done = TOTAL_STEPS;
      ringColor = colors.amberText;
      centre = <CircleAlert size={compact ? 24 : 28} color={colors.amberText} />;
      button = { label: 'View status', onPress: () => onOpenFiling(card.entry) };
      break;
  }
  if (centre === undefined) {
    centre = (
      <Text style={styles.ringText} maxFontSizeMultiplier={1.3}>
        {done}/{TOTAL_STEPS}
      </Text>
    );
  }

  // Before submitting: the deadline. After: when it was submitted.
  let pill: { text: string; tone: 'neutral' | 'amber' | 'done' } | null = null;
  if (card.kind === 'notStarted' || card.kind === 'inProgress') {
    if (deadline) {
      const days = daysUntil(deadline, now);
      pill =
        days < 0
          ? { text: `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`, tone: 'amber' }
          : {
              text: `Due ${formatDeadline(deadline)} · ${days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} left`}`,
              tone: 'neutral',
            };
    }
  } else {
    pill = { text: `Submitted ${formatShortDate(card.entry.submittedAt)}`, tone: 'done' };
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{year} tax return</Text>
          <Text style={titleStyle} accessibilityRole="header">
            {title}
          </Text>
        </View>
        <SegmentedRing
          total={TOTAL_STEPS}
          completed={done}
          {...ring}
          fillColor={ringColor}
          accessibilityLabel={`${done} of ${TOTAL_STEPS} steps done`}
        >
          {centre}
        </SegmentedRing>
      </View>
      {pill ? (
        <View
          style={[
            styles.pill,
            pill.tone === 'amber' && styles.pillAmber,
            pill.tone === 'done' && styles.pillDone,
          ]}
        >
          {pill.tone === 'done' ? (
            <Check size={16} color={colors.primaryDark} />
          ) : (
            <CalendarClock size={16} color={pill.tone === 'amber' ? colors.amberText : colors.primaryDark} />
          )}
          <Text style={[styles.pillText, pill.tone === 'amber' && styles.pillTextAmber]}>{pill.text}</Text>
        </View>
      ) : null}
      <Button
        label={button.label}
        variant="primary"
        onPress={button.onPress}
        loading={button.loading}
        style={styles.cardButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  hero: {
    paddingTop: spacing.sm,
  },
  sheet: {
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.textPrimary,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  greeting: {
    ...typography.h2,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  // Filing card
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    ...typography.overline,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.heroTitle,
    color: colors.textPrimary,
  },
  cardTitleCompact: {
    fontSize: 22,
    lineHeight: 28,
  },
  ringText: {
    ...typography.bodyStrong,
    ...tabularNumbers,
    color: colors.textPrimary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.heroTint,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    marginTop: spacing.md,
    maxWidth: '100%',
  },
  pillAmber: {
    backgroundColor: colors.amberTint,
    borderWidth: 1,
    borderColor: colors.amberBorder,
  },
  pillDone: {
    backgroundColor: colors.successTint,
  },
  pillText: {
    ...typography.caption,
    ...tabularNumbers,
    fontWeight: '600',
    color: colors.primaryDark,
    flexShrink: 1,
  },
  pillTextAmber: {
    color: colors.amberText,
  },
  cardButton: {
    marginTop: spacing.lg,
  },
  errorBody: {
    marginTop: spacing.sm,
  },
  skeleton: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  skeletonLabel: {
    width: 110,
    height: 12,
    marginBottom: spacing.md,
  },
  skeletonTitle: {
    width: '90%',
    height: 24,
    marginBottom: spacing.sm,
  },
  skeletonTitleShort: {
    width: '60%',
    height: 24,
  },
  skeletonButton: {
    height: 52,
    borderRadius: radii.full,
    marginTop: spacing.lg + spacing.md,
  },

  // Shared text
  overline: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  muted: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionLabel: {
    marginBottom: spacing.sm + 4,
  },

  // Estimated tax
  snapshot: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  snapshotTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  snapshotAmount: {
    ...typography.hero,
    ...tabularNumbers,
    color: colors.textPrimary,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  stat: {
    flex: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    ...typography.bodyStrong,
    ...tabularNumbers,
    fontSize: 17,
    color: colors.textPrimary,
  },
  statValueGood: {
    color: colors.primaryDark,
  },

  // Helpful to know
  // Doesn't stretch to fill a short page (the sheet grows to the bottom).
  learnScroll: {
    flexGrow: 0,
    marginHorizontal: -layout.screenPadding,
    marginBottom: spacing.xl,
  },
  learnRow: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm + 4,
  },
  learnCard: {
    width: LEARN_CARD_WIDTH,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  learnIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.heroTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  learnTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  learnLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Past years
  pastList: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  pastText: {
    flex: 1,
  },
  pastYear: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
  },
  pastStatus: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
