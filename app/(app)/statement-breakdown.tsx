/**
 * Statement breakdown — opened from "See breakdown" under an AI-suggested
 * amount on Income Summary. Every credit the AI found in that statement,
 * grouped the way the server counted it (counted as income, already counted
 * in another platform, transfers between your own accounts, refunds, loans,
 * reversals, other, still to answer, outside the tax year), with a total per
 * group. Groups, totals and the suggestion all come from the server
 * (get_extraction_breakdown); this screen only displays them.
 *
 * The user can move any item into or out of income — including a payout
 * the server left out ("This is separate income"). Each change is saved at
 * once, the server recalculates, and the list and Income Summary update.
 * Moving an item back to where the server put it clears the user's choice.
 *
 * ⚠️ No Figma design for this screen — built from the existing Screen,
 * BackButton, Card and caption/link styles.
 */
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  Breakdown,
  breakdownGroupLabel,
  BreakdownItem,
  decisionToCountAsIncome,
  formatIsoDate,
  formatStatementAmount,
  getBreakdown,
} from '../../lib/extractions';
import { formatNaira } from '../../lib/money';
import { useFiling } from '../../state/filingContext';

export default function StatementBreakdownScreen() {
  const { documentId, platform } = useLocalSearchParams<{ documentId?: string; platform?: string }>();
  const { extractionsByDocumentId, decideFlagged } = useFiling();
  const extraction = documentId ? extractionsByDocumentId[documentId] : undefined;
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const extractionId = extraction?.id;
  const load = useCallback(async () => {
    if (!extractionId) {
      setLoadState('error');
      return;
    }
    const result = await getBreakdown(extractionId);
    setBreakdown(result);
    setLoadState(result ? 'loaded' : 'error');
  }, [extractionId]);

  useEffect(() => {
    load();
  }, [load]);

  const move = async (item: BreakdownItem, countAsIncome: boolean) => {
    if (!documentId || busyId) {
      return;
    }
    setBusyId(item.id);
    setErrorId(null);
    const { error } = await decideFlagged(documentId, item.id, decisionToCountAsIncome(item, countAsIncome));
    await load();
    setBusyId(null);
    if (error) {
      setErrorId(item.id);
    }
  };

  const title = platform ? `Your ${platform} statement` : 'Your statement';

  if (loadState !== 'loaded' || !breakdown) {
    return (
      <Screen>
        <BackButton />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.centered}>
          {loadState === 'loading' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={styles.stateText}>Couldn’t load the breakdown.</Text>
              <Button label="Try again" variant="secondary" onPress={load} style={styles.stateButton} />
            </>
          )}
        </View>
      </Screen>
    );
  }

  const money = (minor: number) => formatStatementAmount(minor, breakdown.currency);
  const isNaira = !breakdown.currency || breakdown.currency === 'NGN';

  return (
    <Screen>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          How we worked out your income from this statement. Move anything we got wrong.
        </Text>

        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income for {breakdown.taxYear}</Text>
          <Text style={styles.summaryValue}>
            {isNaira && breakdown.suggestedIncomeKobo !== null
              ? formatNaira(breakdown.suggestedIncomeKobo)
              : money(breakdown.groups.find((g) => g.key === 'income')?.totalMinor ?? 0)}
          </Text>
          {!isNaira ? (
            <Text style={styles.summaryNote}>
              This statement is in {breakdown.currency}. Convert it to naira at the CBN rate
              yourself.
            </Text>
          ) : null}
          {breakdown.platformPayoutsKobo ? (
            <Text style={styles.summaryNote}>
              {money(breakdown.platformPayoutsKobo)} of payouts left out: already counted in your
              other platforms.
            </Text>
          ) : null}
        </Card>

        {!breakdown.canEdit ? (
          <Text style={styles.lockedNote}>
            This statement is part of a submitted return, so it can’t be changed.
          </Text>
        ) : null}

        {breakdown.groups.map((group) => {
          const items = breakdown.items.filter((item) => item.group === group.key);
          return (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{breakdownGroupLabel(group.key, breakdown.taxYear)}</Text>
                <Text style={styles.groupTotal}>{money(group.totalMinor)}</Text>
              </View>
              <Card style={styles.groupCard}>
                {items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.item, index < items.length - 1 && styles.itemDivider]}
                  >
                    <View style={styles.itemTop}>
                      <Text style={styles.itemDescription}>{item.description}</Text>
                      <Text style={styles.itemAmount}>{money(item.amountMinor)}</Text>
                    </View>
                    <Text style={styles.itemMeta}>
                      {formatIsoDate(item.date)}
                      {item.category === 'platform_payout' && item.sourcePlatform
                        ? ` · Already counted in ${item.sourcePlatform}`
                        : ''}
                      {item.decision && !item.needsReview ? ' · Changed by you' : ''}
                    </Text>
                    {breakdown.canEdit && item.inYear ? (
                      <View style={styles.actions}>
                        {busyId === item.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : item.group === 'unsure' ? (
                          <>
                            <ActionLink label="Income" onPress={() => move(item, true)} />
                            <ActionLink label="Not income" onPress={() => move(item, false)} />
                          </>
                        ) : item.counts ? (
                          <ActionLink label="Not income" onPress={() => move(item, false)} />
                        ) : (
                          <ActionLink
                            label={
                              item.category === 'platform_payout'
                                ? 'This is separate income'
                                : 'Count as income'
                            }
                            onPress={() => move(item, true)}
                          />
                        )}
                      </View>
                    ) : null}
                    {errorId === item.id ? (
                      <Text style={styles.errorText}>Couldn’t save that. Try again.</Text>
                    ) : null}
                  </View>
                ))}
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function ActionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={styles.actionLink}>
      <Text style={styles.actionLinkText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  summaryNote: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  lockedNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  groupTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  groupTotal: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
  },
  groupCard: {
    paddingVertical: spacing.xs,
  },
  item: {
    paddingVertical: spacing.sm,
  },
  itemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemDescription: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  itemAmount: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  actionLink: {
    borderRadius: radii.sm,
  },
  actionLinkText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  stateButton: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
