/**
 * Review your tax return. Layout:
 *   - a hero on a soft green tint: tax year and state, the total tax due
 *     (Playfair Display), the income it's based on, and "Deductions saved
 *     you ₦…" when deductions saved tax
 *   - anything still missing, in a calm amber card with each item's Fix
 *   - segmented tabs (cross-fade, no navigation):
 *       Summary      split stat card (taxable income | effective rate), income
 *                    sources, deductions (ones the year doesn't allow are
 *                    muted, with the reason), filing details
 *       Calculation  the server's working as a timeline, income → expenses
 *                    → reliefs → taxable income → your tax band (the top
 *                    band's rate, or "Minimum tax applied") → tax due; "How
 *                    tax bands work" opens a sheet with the year's band
 *                    table (the user's band highlighted) and the per-band
 *                    breakdown
 *       Documents    this year's documents, ticked when linked to a step;
 *                    tapping one opens the document
 *   - a sticky bottom bar: a short line and "Approve and submit", which
 *     opens the "ready to submit" sheet (with the accuracy declaration).
 * ⚠️ Not from a Figma frame: built from the brief and inspiration screenshots
 * (design/inspo/review-screen), with the app's tokens.
 *
 * The tax figures are the server's (filing_tax_calculations, worked out
 * from the saved income and deductions under that tax year's rules and
 * recalculated on every save) — the app only displays them.
 *
 * "Yes, submit my return" calls the server's submit_filing, which checks
 * the draft is complete and returns the filing's reference. While it runs
 * the button shows a spinner; a failure (no connection, or a step the
 * server says is incomplete) shows under the buttons and can be retried.
 *
 * Before anything is submitted, the screen asks the server what's still
 * missing (the same rules submit_filing enforces) every time it's shown.
 * Anything missing is listed in plain English ("Paystack statement not
 * uploaded") with a "Fix" that opens the exact step with that item
 * highlighted; Continue there comes straight back here. "Approve and
 * submit" stays disabled, with a line saying why, until nothing is missing.
 * If the server still refuses on submit (e.g. something changed on another
 * device), its list is shown the same way. The "Edit" links on income and
 * deductions open those steps the same way, so Continue comes back here.
 */
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  CircleAlert,
  CircleHelp,
  CircleCheck,
  FileText,
  House,
  Info,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Wallet,
  HousePlus,
} from 'lucide-react-native';
import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../../components/ui/BackButton';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { Timeline, TimelineItem } from '../../components/ui/Timeline';
import { openFix, RequireDraft, SaveErrorNote } from '../../components/filing/FilingFlow';
import {
  effectiveRate,
  minimumTaxPercent,
  ratePercent,
  TaxBandsSheet,
  topBandIndex,
} from '../../components/filing/HelpSheets';
import { Screen } from '../../components/layout/Screen';
import { colors } from '../../constants/colors';
import { isNigerianBank } from '../../constants/platforms';
import { layout, radii, spacing, tabularNumbers, typography } from '../../constants/theme';
import { categoryLabel, DocumentRecord, listDocuments } from '../../lib/documents';
import { describeMissingItem, getMissingItems, MissingItem } from '../../lib/filings';
import { RELIEF_LABELS, TaxCalculation, taxSavedKobo } from '../../lib/filings';
import { formatNaira } from '../../lib/money';
import { useAuth } from '../../state/authContext';
import { useFiling } from '../../state/filingContext';

type Tab = 'summary' | 'calculation' | 'documents';
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'calculation', label: 'Calculation' },
  { key: 'documents', label: 'Documents' },
];
const TAB_FADE_MS = 180;

/** The first sentence of a server note, for a short reason. */
const firstSentence = (text: string) => text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text;

const DEDUCTION_ICONS: Record<string, typeof PiggyBank> = {
  pension: PiggyBank,
  life_assurance: ShieldCheck,
  nhf: HousePlus,
  rent: House,
};

export default function ReturnReviewScreen() {
  return (
    <RequireDraft>
      <ReturnReviewContent />
    </RequireDraft>
  );
}

function ReturnReviewContent() {
  const {
    totalIncomeKobo,
    incomeSources,
    deductions,
    documentIdsByKey,
    taxYear,
    submit,
    draft,
    refreshDraft,
  } = useFiling();
  const { profile } = useAuth();
  // The state from the profile; when it isn't set, no state is shown at all.
  const stateName = profile?.state?.trim() || null;
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // What's still missing, straight from the server's rules.
  const [missingItems, setMissingItems] = useState<MissingItem[]>([]);
  const [checkState, setCheckState] = useState<'checking' | 'done' | 'failed'>('checking');
  const draftId = draft?.id;

  const checkCompleteness = useCallback(async () => {
    if (!draftId) {
      return;
    }
    setCheckState('checking');
    // Everything is saved by the time you're here, so start from what the
    // server has (it may have changed on another device), and ask it what's
    // missing.
    const [result] = await Promise.all([getMissingItems(draftId), refreshDraft()]);
    if (result.error) {
      setCheckState('failed');
      return;
    }
    setMissingItems(result.items);
    setCheckState('done');
  }, [draftId, refreshDraft]);

  // The documents list (Documents tab): names and categories.
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [documentsState, setDocumentsState] = useState<'loading' | 'done' | 'failed'>('loading');
  const loadDocuments = useCallback(async () => {
    setDocumentsState('loading');
    const result = await listDocuments();
    if (result.error) {
      setDocumentsState('failed');
      return;
    }
    setDocuments(result.documents);
    setDocumentsState('done');
  }, []);

  // Re-checked every time the screen is shown, e.g. after a Fix.
  useFocusEffect(
    useCallback(() => {
      checkCompleteness();
      loadDocuments();
    }, [checkCompleteness, loadDocuments])
  );

  const canSubmit = checkState === 'done' && missingItems.length === 0;
  const missingDetails = missingItems.map(describeMissingItem);
  // The server's calculation for this draft (display only).
  const calc = draft?.taxCalculation ?? null;
  const savedKobo = calc ? taxSavedKobo(calc) : 0;

  const [showSubmitSheet, setShowSubmitSheet] = useState(false);

  // Tabs: a quick fade on switching; the content area keeps the height of
  // the tallest tab seen so far, so switching never makes the page jump.
  const [tab, setTab] = useState<Tab>('summary');
  const fade = useRef(new Animated.Value(1)).current;
  const [contentMinHeight, setContentMinHeight] = useState(0);
  const switchTab = (next: Tab) => {
    if (next === tab) {
      return;
    }
    fade.setValue(0);
    setTab(next);
    Animated.timing(fade, { toValue: 1, duration: TAB_FADE_MS, useNativeDriver: true }).start();
  };
  const handleContentLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setContentMinHeight((previous) => (height > previous ? height : previous));
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    const result = await submit();
    setIsSubmitting(false);
    if (result.error) {
      if (result.error.code === 'not_draft') {
        setShowSubmitSheet(false);
        router.replace('/(app)/filing-history');
        return;
      }
      if (result.error.code === 'incomplete') {
        // The server's own list, shown the same way as the pre-check.
        setMissingItems(result.error.missingItems ?? []);
        setCheckState('done');
        setShowSubmitSheet(false);
        refreshDraft();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      setSubmitError(
        result.error.code === 'network'
          ? 'Couldn’t submit. Check your connection and try again.'
          : result.error.message
      );
      return;
    }
    setShowSubmitSheet(false);
    router.replace({
      pathname: '/(app)/confirmation',
      params: { reference: result.reference, submittedAt: result.submittedAt },
    });
  };

  const editIncome = () => openFix({ id: 'edit-income', label: 'Income', step: 'income_summary' });
  const editDeductions = () => openFix({ id: 'edit-deductions', label: 'Deductions', step: 'deductions' });

  return (
    <Screen backgroundColor={colors.heroTint} edges={['top']}>
      <View style={styles.header}>
        <BackButton style={styles.backButton} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ReceiptText size={20} color={colors.backgroundInverse} />
          </View>
          <Text style={styles.heroLabel} accessibilityRole="header">
            {stateName ? `${taxYear} · ${stateName}` : taxYear}
          </Text>
          <Text
            style={styles.heroAmount}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={calc ? `Tax due ${formatNaira(calc.taxDueKobo)}` : 'Tax due not worked out yet'}
          >
            {calc ? formatNaira(calc.taxDueKobo) : '—'}
          </Text>
          <Text style={styles.heroLine}>
            {calc
              ? `Tax due, based on ${formatNaira(calc.incomeAfterExpensesKobo)} income after expenses`
              : 'We’ll work out your tax once your income is entered.'}
          </Text>
          {savedKobo > 0 ? (
            <View style={styles.savedChip}>
              <PiggyBank size={16} color={colors.primary} />
              <Text style={styles.savedChipText}>Deductions saved you {formatNaira(savedKobo)}</Text>
            </View>
          ) : null}
        </View>

        {/* White content area */}
        <View style={styles.sheet}>
          {checkState === 'done' && missingDetails.length > 0 ? (
            <View style={styles.missingCard}>
              <Text style={styles.missingTitle}>Finish these before you submit</Text>
              {missingDetails.map((item) => (
                <View key={item.id} style={styles.missingRow}>
                  <CircleAlert size={20} color={colors.amberText} />
                  <Text style={styles.missingLabel}>{item.label}</Text>
                  <Pressable
                    onPress={() => openFix(item)}
                    style={styles.linkTarget}
                    accessibilityRole="button"
                    accessibilityLabel={`Fix: ${item.label}`}
                  >
                    <Text style={styles.link}>Fix</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <SegmentedTabs tabs={TABS} value={tab} onChange={switchTab} style={styles.tabs} />

          <Animated.View style={[{ opacity: fade, minHeight: contentMinHeight }]}>
            <View onLayout={handleContentLayout}>
              {tab === 'summary' ? (
                <SummaryTab
                  calc={calc}
                  taxYear={taxYear}
                  stateName={stateName}
                  totalIncomeKobo={totalIncomeKobo}
                  incomeSources={incomeSources}
                  deductions={deductions}
                  onEditIncome={editIncome}
                  onEditDeductions={editDeductions}
                />
              ) : tab === 'calculation' ? (
                <CalculationTab calc={calc} />
              ) : (
                <DocumentsTab
                  documents={documents}
                  state={documentsState}
                  onRetry={loadDocuments}
                  taxYear={taxYear}
                  documentIdsByKey={documentIdsByKey}
                  platforms={incomeSources.map((source) => source.label)}
                />
              )}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Sticky bottom */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        {checkState === 'checking' ? (
          <View style={styles.bottomNoteRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.bottomNote}>Checking your return…</Text>
          </View>
        ) : checkState === 'failed' ? (
          <View style={styles.bottomNoteRow}>
            <Text style={styles.bottomNote}>Couldn’t check your return. Check your connection.</Text>
            <Pressable onPress={checkCompleteness} style={styles.linkTarget} accessibilityRole="button">
              <Text style={styles.link}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bottomNoteRow}>
            <Text style={styles.bottomNote}>
              {missingDetails.length > 0
                ? `Finish the ${missingDetails.length === 1 ? 'item' : `${missingDetails.length} items`} above before you submit.`
                : 'Check everything before you submit. You can’t edit after.'}
            </Text>
          </View>
        )}
        <Button
          label="Approve and submit"
          variant="primary"
          onPress={() => setShowSubmitSheet(true)}
          disabled={!canSubmit}
        />
      </View>

      <BottomSheet visible={showSubmitSheet} onClose={() => setShowSubmitSheet(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Ready to submit your return?</Text>
          <Text style={styles.sheetBody}>
            Once you submit it, you won&apos;t be able to make changes through Fileo. Please
            review your information before you continue.
          </Text>

          <View style={styles.submittingToRow}>
            <Text style={styles.submittingToLabel}>Submitting to:</Text>
            <View style={styles.submittingToBadge}>
              <View style={styles.badge}>
                <Landmark size={16} color={colors.primary} />
              </View>
              <Text style={styles.submittingToName}>Federal Inland Revenue Service (FIRS)</Text>
            </View>
          </View>

          <View style={styles.declaration}>
            <Info size={16} color={colors.textSecondary} style={styles.declarationIcon} />
            <Text style={styles.declarationText}>
              By submitting, you confirm that the information provided is accurate to the best of
              your knowledge.
            </Text>
          </View>

          <Button
            label="Yes, submit my return"
            variant="primary"
            onPress={handleSubmit}
            loading={isSubmitting}
          />
          <Button
            label="Not yet — let me review again"
            variant="secondary"
            onPress={() => setShowSubmitSheet(false)}
            style={styles.sheetSecondaryButton}
          />
          <SaveErrorNote message={submitError} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
function SummaryTab({
  calc,
  taxYear,
  stateName,
  totalIncomeKobo,
  incomeSources,
  deductions,
  onEditIncome,
  onEditDeductions,
}: {
  calc: TaxCalculation | null;
  taxYear: number;
  stateName: string | null;
  totalIncomeKobo: number;
  incomeSources: { id: string; label: string; amountKobo: number | null }[];
  deductions: { id: string; label: string; amountPaidKobo: number | null }[];
  onEditIncome: () => void;
  onEditDeductions: () => void;
}) {
  return (
    <View>
      <View style={styles.statCard}>
        <View style={styles.statHalf}>
          <Text style={styles.statLabel}>Taxable income</Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
            {calc ? formatNaira(calc.taxableIncomeKobo) : '—'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statHalf}>
          <Text style={styles.statLabel}>Effective rate</Text>
          <Text style={[styles.statValue, styles.statValueRate]} numberOfLines={1} adjustsFontSizeToFit>
            {calc ? effectiveRate(calc) : '—'}
          </Text>
        </View>
      </View>

      <SectionHeader title="Income sources" onEdit={onEditIncome} editLabel="Edit income sources" />
      <Card style={styles.listCard}>
        {incomeSources.length === 0 ? (
          <Text style={styles.emptyText}>No income sources recorded.</Text>
        ) : (
          incomeSources.map((source, index) => (
            <ListRow
              key={source.id}
              first={index === 0}
              badge={
                isNigerianBank(source.label) ? (
                  <Landmark size={16} color={colors.primary} />
                ) : (
                  <Wallet size={16} color={colors.primary} />
                )
              }
              label={source.label}
              value={source.amountKobo === null ? '—' : formatNaira(source.amountKobo)}
            />
          ))
        )}
        {incomeSources.length > 1 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatNaira(totalIncomeKobo)}</Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="Deductions" onEdit={onEditDeductions} editLabel="Edit deductions" />
      <Card style={styles.listCard}>
        {deductions.length === 0 ? (
          <Text style={styles.emptyText}>No deductions claimed.</Text>
        ) : (
          deductions.map((deduction, index) => {
            const relief = calc?.reliefs.find((r) => r.code === deduction.id);
            const notApplied = relief?.status === 'not_applied';
            const Icon = DEDUCTION_ICONS[deduction.id] ?? ReceiptText;
            const amountKobo = relief ? relief.appliedKobo : deduction.amountPaidKobo;
            let note: string | undefined;
            if (notApplied) {
              note = relief?.note ? firstSentence(relief.note) : `Not allowed for ${taxYear}.`;
            } else if (relief && relief.claimedKobo !== null && relief.claimedKobo !== relief.appliedKobo) {
              note = `You paid ${formatNaira(relief.claimedKobo)}${relief.status === 'capped' ? '; capped' : ''}.`;
            }
            return (
              <ListRow
                key={deduction.id}
                first={index === 0}
                muted={notApplied}
                badge={<Icon size={16} color={notApplied ? colors.textSecondary : colors.primary} />}
                label={RELIEF_LABELS[deduction.id] ?? deduction.label}
                value={notApplied ? 'Not applied' : amountKobo === null ? '—' : formatNaira(amountKobo)}
                note={note}
              />
            );
          })
        )}
      </Card>

      <SectionHeader title="Filing details" />
      <Card style={styles.listCard}>
        <ListRow first label="Tax year" value={String(taxYear)} plain />
        {stateName ? <ListRow label="State" value={stateName} plain /> : null}
        <ListRow label="Prepared by" value="Fileo Tax Professional" plain />
      </Card>
    </View>
  );
}

// ─── Calculation ─────────────────────────────────────────────────────────────
/** The "Your tax band" step: the top band's rate and one plain line, all
 * from the stored calculation. */
function taxBandStep(calc: TaxCalculation): TimelineItem {
  if (calc.minimumTaxApplied && calc.minimumTaxKobo !== null) {
    const percent = minimumTaxPercent(calc);
    return {
      key: 'band',
      label: 'Minimum tax applied',
      value: formatNaira(calc.minimumTaxKobo),
      detail: percent
        ? `Your tax from the bands was lower than ${percent} of your income, so the minimum tax of ${percent} applies.`
        : 'Your tax from the bands was lower than the minimum tax, so the minimum tax applies.',
    };
  }
  const index = topBandIndex(calc);
  if (index === null) {
    return {
      key: 'band',
      label: 'Your tax band',
      value: ratePercent(0),
      detail: 'You have no taxable income, so there’s no tax from the bands.',
    };
  }
  const band = calc.bands[index];
  const rate = ratePercent(band.rateBp);
  let detail: string;
  if (index === 0) {
    detail =
      band.rateBp === 0
        ? 'Your income is below the taxable threshold, so there’s no tax from the bands.'
        : `All your taxable income is taxed at ${rate}.`;
  } else {
    detail = `Only the part of your taxable income above ${formatNaira(band.fromKobo)} is taxed at ${rate}. On average, you pay ${effectiveRate(calc)}.`;
  }
  return { key: 'band', label: 'Your tax band', value: rate, detail };
}

function CalculationTab({ calc }: { calc: TaxCalculation | null }) {
  const [showBands, setShowBands] = useState(false);
  if (!calc) {
    return <Text style={styles.emptyState}>We’ll work out your tax once your income is entered.</Text>;
  }
  const items: TimelineItem[] = [
    { key: 'income', section: 'Income', label: 'Total income', value: formatNaira(calc.grossIncomeKobo) },
  ];
  if (calc.businessExpensesKobo > 0) {
    items.push({
      key: 'expenses',
      label: 'Business expenses',
      value: `− ${formatNaira(calc.businessExpensesKobo)}`,
      detail: `Income after expenses ${formatNaira(calc.incomeAfterExpensesKobo)}`,
    });
  }
  items.push({
    key: 'reliefs',
    section: 'Reliefs and deductions',
    label: 'Total reliefs',
    value: `− ${formatNaira(calc.totalReliefsKobo)}`,
    subItems: calc.reliefs.map((relief) => ({
      key: relief.code,
      label: RELIEF_LABELS[relief.code] ?? relief.code,
      value: relief.status === 'not_applied' ? 'Not applied' : `− ${formatNaira(relief.appliedKobo)}`,
      muted: relief.status === 'not_applied',
      note:
        relief.status === 'not_applied' && relief.note
          ? firstSentence(relief.note)
          : relief.claimedKobo !== null && relief.claimedKobo !== relief.appliedKobo
            ? `You paid ${formatNaira(relief.claimedKobo)}${relief.status === 'capped' ? '; capped' : ''}.`
            : undefined,
    })),
  });
  items.push({
    key: 'taxable',
    label: 'Taxable income',
    value: formatNaira(calc.taxableIncomeKobo),
    tone: 'strong',
  });
  items.push({ ...taxBandStep(calc), section: 'Tax' });
  items.push({ key: 'due', section: 'Result', label: 'Tax due', value: formatNaira(calc.taxDueKobo), tone: 'final' });

  return (
    <View>
      <Card style={styles.timelineCard}>
        <Timeline items={items} />
      </Card>
      <Pressable
        onPress={() => setShowBands(true)}
        style={styles.bandsLink}
        accessibilityRole="button"
        accessibilityHint="Opens an explanation with the full band table"
      >
        <CircleHelp size={16} color={colors.primary} />
        <Text style={styles.link}>How tax bands work</Text>
      </Pressable>
      <Text style={styles.rulesNote}>
        Calculated under the {calc.rulesName ?? 'tax rules for this year'} ({calc.rulesVersion}). Amounts
        are rounded to the nearest kobo at each step.
      </Text>
      <BottomSheet visible={showBands} onClose={() => setShowBands(false)}>
        <TaxBandsSheet taxYear={calc.taxYear} bands={calc.bands} calc={calc} onClose={() => setShowBands(false)} />
      </BottomSheet>
    </View>
  );
}

// ─── Documents ───────────────────────────────────────────────────────────────
function DocumentsTab({
  documents,
  state,
  onRetry,
  taxYear,
  documentIdsByKey,
  platforms,
}: {
  documents: DocumentRecord[] | null;
  state: 'loading' | 'done' | 'failed';
  onRetry: () => void;
  taxYear: number;
  documentIdsByKey: Record<string, string>;
  platforms: string[];
}) {
  if (state === 'loading' && !documents) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (state === 'failed' && !documents) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyState}>Couldn’t load your documents.</Text>
        <Pressable onPress={onRetry} style={styles.linkTarget} accessibilityRole="button">
          <Text style={styles.link}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Which step each document is linked to (slot key -> readable name).
  const linkedTo: Record<string, string> = {};
  const slotOrder: Record<string, number> = {};
  Object.entries(documentIdsByKey).forEach(([key, id]) => {
    const deduction = key.startsWith('deduction:') ? key.slice('deduction:'.length) : null;
    linkedTo[id] = deduction ? (RELIEF_LABELS[deduction] ?? deduction) : key;
    const platformIndex = platforms.indexOf(key);
    slotOrder[id] = platformIndex >= 0 ? platformIndex : 100 + Object.keys(RELIEF_LABELS).indexOf(deduction ?? '');
  });
  const shown = (documents ?? [])
    .filter((doc) => doc.tax_year === taxYear || linkedTo[doc.id])
    .sort((a, b) => (slotOrder[a.id] ?? 1000) - (slotOrder[b.id] ?? 1000));

  if (shown.length === 0) {
    return <Text style={styles.emptyState}>No documents for {taxYear} yet.</Text>;
  }
  return (
    <Card style={styles.listCard}>
      {shown.map((doc, index) => {
        const linked = linkedTo[doc.id];
        return (
          <Pressable
            key={doc.id}
            onPress={() => router.push({ pathname: '/(app)/document-detail', params: { id: doc.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${doc.file_name}, ${categoryLabel(doc.category)}${linked ? `, linked to ${linked}` : ''}`}
            style={({ pressed }) => [styles.docRow, index > 0 && styles.rowDivider, pressed && styles.pressed]}
          >
            <View style={styles.badge}>
              <FileText size={16} color={colors.primary} />
            </View>
            <View style={styles.docText}>
              <Text style={styles.docName} numberOfLines={2}>
                {doc.file_name}
              </Text>
              <Text style={styles.docMeta} numberOfLines={1}>
                {categoryLabel(doc.category)}
                {linked ? ` · ${linked}` : ''}
              </Text>
            </View>
            {linked ? <CircleCheck size={20} color={colors.primary} /> : null}
            <ChevronRight size={20} color={colors.mutedStroke} />
          </Pressable>
        );
      })}
    </Card>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────
function SectionHeader({ title, onEdit, editLabel }: { title: string; onEdit?: () => void; editLabel?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {onEdit ? (
        <Pressable onPress={onEdit} style={styles.linkTarget} accessibilityRole="button" accessibilityLabel={editLabel}>
          <Text style={styles.link}>Edit</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ListRow({
  label,
  value,
  badge,
  note,
  muted,
  first,
  plain,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
  note?: string;
  muted?: boolean;
  first?: boolean;
  /** No badge, lighter label (details list). */
  plain?: boolean;
}) {
  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      {badge ? <View style={[styles.badge, muted && styles.badgeMuted]}>{badge}</View> : null}
      <View style={styles.rowText}>
        <Text style={[plain ? styles.rowLabelPlain : styles.rowLabel, muted && styles.mutedText]}>{label}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
      <Text style={[styles.rowValue, muted && styles.mutedText]}>{value}</Text>
    </View>
  );
}

const BADGE = 36;

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.xs,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: 0,
  },
  // The scroll area runs edge to edge; the hero and the sheet pad themselves.
  scroll: {
    marginHorizontal: -layout.screenPadding,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: 0,
    paddingBottom: spacing.lg,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(11, 22, 40, 0.16)',
    backgroundColor: colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  heroAmount: {
    ...typography.hero,
    ...tabularNumbers,
    color: colors.backgroundInverse,
    marginTop: 2,
  },
  heroLine: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm + 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: colors.primaryLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(11, 110, 79, 0.18)',
  },
  savedChipText: {
    ...typography.caption,
    ...tabularNumbers,
    fontWeight: '600',
    color: colors.primary,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  missingCard: {
    backgroundColor: colors.amberTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amberBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    marginBottom: spacing.lg,
  },
  missingTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.amberText,
    marginBottom: spacing.xs,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  missingLabel: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  tabs: {
    marginBottom: spacing.lg,
  },
  statCard: {
    flexDirection: 'row',
    backgroundColor: colors.offWhite,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md + 4,
  },
  statHalf: {
    flex: 1,
    gap: spacing.xs,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.h3,
    ...tabularNumbers,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statValueRate: {
    color: colors.primaryDark,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    minHeight: 44,
  },
  sectionTitle: {
    ...typography.overline,
    color: colors.textSecondary,
  },
  linkTarget: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  link: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  listCard: {
    backgroundColor: colors.background,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 56,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    backgroundColor: colors.heroTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMuted: {
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowLabelPlain: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  rowNote: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowValue: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  mutedText: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm + 4,
  },
  totalLabel: {
    ...typography.caption,
    fontSize: 14,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.bodyStrong,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.md,
  },
  declaration: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  declarationIcon: {
    marginTop: 2,
  },
  declarationText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  timelineCard: {
    backgroundColor: colors.background,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  bandsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 44,
    marginTop: spacing.sm,
  },
  rulesNote: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyState: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    minHeight: 64,
    paddingVertical: spacing.sm + 2,
  },
  docText: {
    flex: 1,
  },
  docName: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  docMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  bottomBar: {
    marginHorizontal: -layout.screenPadding,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm + 4,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 32,
    marginBottom: spacing.sm,
  },
  bottomNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  sheetContent: {
    width: '100%',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  submittingToRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  submittingToLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  submittingToBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  submittingToName: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    flex: 1,
  },
  sheetSecondaryButton: {
    marginTop: spacing.sm,
  },
});
