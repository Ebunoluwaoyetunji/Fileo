/**
 * Short plain-English explanations shown in a BottomSheet:
 *
 *  - TaxBandsSheet: how tax bands work, the year's band table and, with the
 *    user's calculation, their band highlighted and their breakdown (Return
 *    Review's Calculation tab and Home's "Helpful to know" row).
 *  - IncomeHelpSheet, DeductionsHelpSheet, DeadlineHelpSheet: Home's other
 *    "Helpful to know" cards.
 *
 * Everything that depends on the tax year (bands, which deductions are
 * allowed, the deadline) comes from the server's rules table or
 * constants/deadlines.ts, never hard-coded here.
 *
 * Also exports the small display helpers for tax bands that Return Review
 * uses in its working.
 */
import { Check, X } from 'lucide-react-native';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../ui/Button';
import { colors } from '../../constants/colors';
import { daysUntil, filingDeadline, formatDeadlineLong } from '../../constants/deadlines';
import { DEDUCTION_DEFINITIONS } from '../../constants/deductions';
import { radii, spacing, tabularNumbers, typography } from '../../constants/theme';
import { BandRate, ReliefRule, TaxCalculation } from '../../lib/filings';
import { formatNaira } from '../../lib/money';

// ─── Tax band helpers ────────────────────────────────────────────────────────
/** 700 -> "7%", 750 -> "7.5%". */
export const ratePercent = (rateBp: number) => `${rateBp / 100}%`;

/** Tax due as a share of income after expenses, e.g. "12.3%". No income
 * means no tax, so 0.0% rather than a division by zero. */
export function effectiveRate(calc: TaxCalculation) {
  if (calc.incomeAfterExpensesKobo <= 0) {
    return '0.0%';
  }
  return `${((calc.taxDueKobo / calc.incomeAfterExpensesKobo) * 100).toFixed(1)}%`;
}

/** "First ₦300,000", "Next ₦500,000", "Above ₦3,200,000". */
export function bandSlice(band: BandRate, index: number) {
  if (band.widthKobo === null) {
    return `Above ${formatNaira(band.fromKobo)}`;
  }
  return `${index === 0 ? 'First' : 'Next'} ${formatNaira(band.widthKobo)}`;
}

/** The highest band any of the taxable income reaches (null: none). */
export function topBandIndex(calc: TaxCalculation) {
  for (let i = calc.bands.length - 1; i >= 0; i -= 1) {
    if (calc.bands[i].taxableKobo > 0) {
      return i;
    }
  }
  return null;
}

/** The minimum tax as a share of the income it's based on ("1%"), from the
 * stored figures. The server applies it to income after expenses and
 * deductions (not the consolidated relief allowance). */
export function minimumTaxPercent(calc: TaxCalculation) {
  const deductedKobo = calc.reliefs
    .filter((relief) => relief.code !== 'cra')
    .reduce((sum, relief) => sum + relief.appliedKobo, 0);
  const baseKobo = calc.incomeAfterExpensesKobo - deductedKobo;
  if (calc.minimumTaxKobo === null || baseKobo <= 0) {
    return null;
  }
  const percent = Math.round((calc.minimumTaxKobo / baseKobo) * 1000) / 10;
  return `${percent}%`;
}

// ─── Shared shell ────────────────────────────────────────────────────────────
function HelpSheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.content}>
      <ScrollView style={{ maxHeight: height * 0.68 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {children}
      </ScrollView>
      <Button label="Got it" variant="primary" onPress={onClose} style={styles.button} />
    </View>
  );
}

/** A line with a tick (yes), a cross (no) or a plain bullet (neither). */
function Point({ yes, children }: { yes?: boolean; children: ReactNode }) {
  const Icon = yes ? Check : X;
  return (
    <View style={styles.point}>
      {yes === undefined ? (
        <View style={styles.bullet} />
      ) : (
        <View style={[styles.pointIcon, !yes && styles.pointIconNo]}>
          <Icon size={14} color={yes ? colors.primary : colors.textSecondary} />
        </View>
      )}
      <Text style={styles.pointText}>{children}</Text>
    </View>
  );
}

// ─── How tax bands work ──────────────────────────────────────────────────────
export function TaxBandsSheet({
  taxYear,
  bands,
  calc,
  onClose,
}: {
  taxYear: number;
  /** The year's bands; null while loading or if they couldn't be loaded. */
  bands: BandRate[] | null;
  /** The user's calculation: highlights their band and adds their breakdown. */
  calc?: TaxCalculation | null;
  onClose: () => void;
}) {
  const top = calc ? topBandIndex(calc) : null;
  const taxed = calc ? calc.bands.filter((band) => band.taxableKobo > 0) : [];
  const minimumPercent = calc ? minimumTaxPercent(calc) : null;
  return (
    <HelpSheet title="How tax bands work" onClose={onClose}>
      <Text style={styles.body}>
        Your taxable income is split into bands, and each band has its own rate, starting low and
        rising. A higher rate only applies to the part of your income inside that band, not to all
        of it. That’s why the rate you pay on average is lower than your top band.
      </Text>

      {bands && bands.length > 0 ? (
        <>
          <Text style={styles.heading}>{taxYear} tax bands</Text>
          <View style={styles.bandTable}>
            {bands.map((band, index) => {
              const mine = index === top;
              return (
                <View
                  key={band.fromKobo}
                  style={[
                    styles.bandRow,
                    index > 0 && !mine && index - 1 !== top && styles.rowDivider,
                    mine && styles.bandRowMine,
                  ]}
                  accessibilityLabel={`${bandSlice(band, index)} at ${ratePercent(band.rateBp)}${mine ? ', your band' : ''}`}
                >
                  <Text style={[styles.bandSlice, mine && styles.bandTextMine]}>{bandSlice(band, index)}</Text>
                  {mine ? <Text style={styles.bandTag}>Your band</Text> : null}
                  <Text style={[styles.bandRate, mine && styles.bandTextMine]}>{ratePercent(band.rateBp)}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {calc ? (
        <>
          <Text style={styles.heading}>Your breakdown</Text>
          {taxed.length === 0 ? (
            <Text style={styles.note}>No taxable income, so no tax from the bands.</Text>
          ) : (
            taxed.map((band) => (
              <View key={band.fromKobo} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  {formatNaira(band.taxableKobo)} at {ratePercent(band.rateBp)}
                </Text>
                <Text style={styles.breakdownValue}>{formatNaira(band.taxKobo)}</Text>
              </View>
            ))
          )}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownLabelStrong}>Tax from the bands</Text>
            <Text style={styles.breakdownValueStrong}>{formatNaira(calc.bandTaxKobo)}</Text>
          </View>
          {calc.minimumTaxKobo !== null ? (
            <>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Minimum tax{minimumPercent ? ` (${minimumPercent} of income)` : ''}
                </Text>
                <Text style={styles.breakdownValue}>{formatNaira(calc.minimumTaxKobo)}</Text>
              </View>
              <Text style={styles.note}>
                {calc.minimumTaxApplied
                  ? 'Your tax from the bands is lower, so the minimum tax applies.'
                  : 'Your tax from the bands is higher, so the minimum tax doesn’t apply.'}
              </Text>
            </>
          ) : null}
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={styles.breakdownLabelStrong}>Tax due</Text>
            <Text style={[styles.breakdownValueStrong, styles.breakdownDue]}>{formatNaira(calc.taxDueKobo)}</Text>
          </View>
        </>
      ) : null}
    </HelpSheet>
  );
}

// ─── What counts as income ───────────────────────────────────────────────────
export function IncomeHelpSheet({ taxYear, onClose }: { taxYear: number; onClose: () => void }) {
  return (
    <HelpSheet title="What counts as income" onClose={onClose}>
      <Text style={styles.body}>
        Income is money you earned from your work in {taxYear}, before fees and expenses come off.
      </Text>
      <Text style={styles.heading}>Counts</Text>
      <Point yes>Payments from clients, in naira or another currency</Point>
      <Point yes>What you earned on platforms like Upwork or Paystack</Point>
      <Point yes>Money paid straight into your bank for your work</Point>
      <Text style={styles.heading}>Doesn’t count</Text>
      <Point yes={false}>Money moved between your own accounts</Point>
      <Point yes={false}>Loans, refunds and reversals</Point>
      <Point yes={false}>Payouts from a platform you’ve already counted</Point>
      <Text style={[styles.note, styles.noteSpaced]}>
        Business expenses, like tools and software you pay for to do your work, come off your income
        before tax is worked out.
      </Text>
    </HelpSheet>
  );
}

// ─── Deductions you can claim ────────────────────────────────────────────────
export function DeductionsHelpSheet({
  taxYear,
  reliefs,
  hasConsolidatedRelief,
  onClose,
}: {
  taxYear: number;
  /** The year's rules; null while loading or if they couldn't be loaded. */
  reliefs: Record<string, ReliefRule> | null;
  hasConsolidatedRelief: boolean;
  onClose: () => void;
}) {
  return (
    <HelpSheet title="Deductions you can claim" onClose={onClose}>
      <Text style={styles.body}>
        Deductions lower the income you’re taxed on. You’ll need a document for each one you claim.
      </Text>
      <Text style={styles.heading}>For {taxYear}</Text>
      {DEDUCTION_DEFINITIONS.map((definition) => {
        const rule = reliefs?.[definition.id];
        const allowed = rule ? rule.allowed : true;
        const detail = !allowed
          ? rule?.reason
          : rule?.note ?? `You’ll need your ${definition.documentLabel}.`;
        return (
          <View key={definition.id} style={styles.deduction}>
            <Point yes={allowed}>
              <Text style={styles.pointStrong}>{definition.label}</Text>
              {detail ? `\n${detail}` : ''}
            </Point>
          </View>
        );
      })}
      {hasConsolidatedRelief ? (
        <Text style={[styles.note, styles.noteSpaced]}>
          You also get the consolidated relief allowance automatically. There’s nothing to claim.
        </Text>
      ) : null}
    </HelpSheet>
  );
}

// ─── When your return is due ─────────────────────────────────────────────────
export function DeadlineHelpSheet({ taxYear, onClose }: { taxYear: number; onClose: () => void }) {
  const deadline = filingDeadline(taxYear);
  const late = deadline ? daysUntil(deadline) < 0 : false;
  return (
    <HelpSheet title="When your return is due" onClose={onClose}>
      <Text style={styles.body}>
        Your {taxYear} return covers what you earned from 1 January to 31 December {taxYear}.
        {deadline ? ` It’s due by ${formatDeadlineLong(deadline)}.` : ''}
      </Text>
      {late ? (
        <View style={styles.amber}>
          <Text style={styles.amberText}>
            The deadline has passed. File as soon as you can: the longer it’s left, the more
            penalties can add up.
          </Text>
        </View>
      ) : null}
      <Text style={styles.heading}>Good to know</Text>
      <Point>You can file any time before the deadline. Starting early gives you time to find your documents.</Point>
      <Point>Filing late can mean penalties and interest on top of the tax itself.</Point>
      <Point>Your progress is saved at each step, so you can finish in more than one sitting.</Point>
    </HelpSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  heading: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
    paddingVertical: 6,
  },
  pointIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.heroTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
    marginHorizontal: 9,
  },
  pointIconNo: {
    backgroundColor: colors.surface,
  },
  pointText: {
    ...typography.body,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  pointStrong: {
    fontWeight: '600',
  },
  deduction: {
    marginBottom: spacing.xs,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  noteSpaced: {
    marginTop: spacing.md,
  },
  amber: {
    backgroundColor: colors.amberTint,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  amberText: {
    ...typography.body,
    fontSize: 15,
    color: colors.amberText,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bandTable: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xs,
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md - 4,
    paddingVertical: spacing.sm,
  },
  bandRowMine: {
    backgroundColor: colors.heroTint,
    borderRadius: radii.md,
  },
  bandSlice: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  bandRate: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
    minWidth: 44,
    textAlign: 'right',
  },
  bandTextMine: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  bandTag: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.background,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 6,
  },
  breakdownTotal: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  breakdownLabel: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textSecondary,
    flex: 1,
  },
  breakdownValue: {
    ...typography.body,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
  },
  breakdownLabelStrong: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
  },
  breakdownValueStrong: {
    ...typography.bodyStrong,
    ...tabularNumbers,
    fontSize: 15,
    color: colors.textPrimary,
  },
  breakdownDue: {
    color: colors.primaryDark,
  },
});
