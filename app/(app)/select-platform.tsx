/**
 * Select Platform — from the Figma frame: 3 categories of platform tiles
 * (International / Nigerian fintechs / Content & creator), a progress bar,
 * and a Continue CTA. Tapping "Others" under Nigerian fintechs drills into
 * select-bank.tsx (its own Figma frame); the other two categories' "Others"
 * has no drill-down frame, so it's just a plain toggle chip.
 *
 * The "N platforms selected" count wasn't visible in any frame sent — added
 * in a standard spot (under the heading) as a reasonable default.
 *
 * Selections are saved to the draft filing when Continue is tapped.
 */
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RequireDraft, SaveErrorNote, useSaveAndContinue } from '../../components/filing/FilingFlow';
import { Screen } from '../../components/layout/Screen';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { colors } from '../../constants/colors';
import { BANK_STATEMENT_MESSAGE, isNigerianBank, PLATFORM_CATEGORIES } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

const NIGERIAN_FINTECHS_TITLE = 'Nigerian fintechs';

export default function SelectPlatformScreen() {
  return (
    <RequireDraft>
      <SelectPlatformContent />
    </RequireDraft>
  );
}

function SelectPlatformContent() {
  const { selectedPlatforms, togglePlatform } = useFiling();
  const { isSaving, error, saveAndContinue } = useSaveAndContinue(
    'upload_documents',
    '/(app)/upload-documents'
  );
  const selectedCount = selectedPlatforms.length;

  const handlePlatformPress = (categoryTitle: string, platform: string) => {
    if (platform === 'Others' && categoryTitle === NIGERIAN_FINTECHS_TITLE) {
      router.push('/(app)/select-bank');
      return;
    }
    togglePlatform(platform);
  };

  return (
    <Screen>
      <BackButton />
      <FilingProgressBar step={1} />
      <Text style={styles.title}>Select all the platforms you received payments from</Text>

      {selectedCount > 0 ? (
        <Text style={styles.count}>
          {selectedCount} platform{selectedCount === 1 ? '' : 's'} selected
        </Text>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {PLATFORM_CATEGORIES.map((category) => {
          const selectedBanks =
            category.title === NIGERIAN_FINTECHS_TITLE
              ? selectedPlatforms.filter(isNigerianBank)
              : [];

          return (
            <View key={category.title} style={styles.category}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <View style={styles.grid}>
                {category.platforms.map((platform) => {
                  const isOthersDrilldown =
                    platform === 'Others' && category.title === NIGERIAN_FINTECHS_TITLE;
                  const isSelected = isOthersDrilldown
                    ? selectedBanks.length > 0
                    : selectedPlatforms.includes(platform);

                  return (
                    <Pressable
                      key={platform}
                      onPress={() => handlePlatformPress(category.title, platform)}
                      style={[styles.tile, isSelected && styles.tileSelected]}
                    >
                      <Text style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                        {platform}
                      </Text>
                      {isOthersDrilldown && selectedBanks.length > 0 ? (
                        <Text style={styles.tileSubLabel}>{selectedBanks.length} selected</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {selectedBanks.length > 0 ? (
                <View style={styles.autoPullNote}>
                  <Text style={styles.autoPullNoteLabel}>
                    {selectedBanks.join(', ')}
                  </Text>
                  <Text style={styles.autoPullNoteText}>{BANK_STATEMENT_MESSAGE}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <Button
        label="Continue"
        disabled={selectedCount === 0}
        loading={isSaving}
        onPress={() => saveAndContinue()}
        style={styles.continueButton}
      />
      <SaveErrorNote message={error} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.display,
    fontSize: 24,
    lineHeight: 30,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  scroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.lg,
  },
  category: {
    marginBottom: spacing.lg,
  },
  categoryTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '31%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  tileLabel: {
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tileLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  tileSubLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  autoPullNote: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  autoPullNoteLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryDark,
    marginBottom: 2,
  },
  autoPullNoteText: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  continueButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
