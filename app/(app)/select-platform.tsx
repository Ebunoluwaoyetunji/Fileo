/**
 * Select Platform — from the Figma frame: 3 categories of platform tiles
 * (International / Nigerian fintechs / Content & creator), a progress bar,
 * and a Continue CTA. Tapping "Others" under Nigerian fintechs drills into
 * select-bank.tsx (its own Figma frame); the other two categories' "Others"
 * has no drill-down frame, so it's just a plain toggle chip.
 *
 * The "N platforms selected" count wasn't visible in any frame sent — added
 * in a standard spot (under the heading) as a reasonable default.
 */
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { FilingProgressBar } from '../../components/ui/FilingProgressBar';
import { colors } from '../../constants/colors';
import { isNigerianBank, PLATFORM_CATEGORIES } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

const NIGERIAN_FINTECHS_TITLE = 'Nigerian fintechs';

export default function SelectPlatformScreen() {
  const { selectedPlatforms, togglePlatform } = useFiling();
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
        {PLATFORM_CATEGORIES.map((category) => (
          <View key={category.title} style={styles.category}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <View style={styles.grid}>
              {category.platforms.map((platform) => {
                const isOthersDrilldown =
                  platform === 'Others' && category.title === NIGERIAN_FINTECHS_TITLE;
                const isSelected = isOthersDrilldown
                  ? selectedPlatforms.some(isNigerianBank)
                  : selectedPlatforms.includes(platform);
                const selectedBankCount = isOthersDrilldown
                  ? selectedPlatforms.filter(isNigerianBank).length
                  : 0;

                return (
                  <Pressable
                    key={platform}
                    onPress={() => handlePlatformPress(category.title, platform)}
                    style={[styles.tile, isSelected && styles.tileSelected]}
                  >
                    <Text style={[styles.tileLabel, isSelected && styles.tileLabelSelected]}>
                      {platform}
                    </Text>
                    {selectedBankCount > 0 ? (
                      <Text style={styles.tileSubLabel}>{selectedBankCount} selected</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <Button
        label="Continue"
        disabled={selectedCount === 0}
        onPress={() => router.push('/(app)/upload-documents')}
        style={styles.continueButton}
      />
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
  continueButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
