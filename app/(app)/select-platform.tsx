import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

const PLATFORMS = ['Freelance / Gig work', 'Salaried employment', 'Small business', 'Investments'];

export default function SelectPlatformScreen() {
  const { selectedPlatforms, togglePlatform } = useFiling();
  const [isSheetVisible, setSheetVisible] = useState(false);

  return (
    <Screen>
      <Text style={styles.title}>Where do you earn income?</Text>
      <Text style={styles.subtitle}>Select all that apply.</Text>

      {PLATFORMS.map((platform) => {
        const isSelected = selectedPlatforms.includes(platform);
        return (
          <Pressable key={platform} onPress={() => togglePlatform(platform)}>
            <Card style={[styles.option, isSelected && styles.optionSelected]}>
              <Text style={styles.optionLabel}>{platform}</Text>
            </Card>
          </Pressable>
        );
      })}

      <Pressable onPress={() => setSheetVisible(true)}>
        <Text style={styles.learnMore}>Why do we need this?</Text>
      </Pressable>

      <Button
        label="Continue"
        disabled={selectedPlatforms.length === 0}
        onPress={() => router.push('/(app)/upload-documents')}
        style={styles.continueButton}
      />

      <BottomSheet visible={isSheetVisible} onClose={() => setSheetVisible(false)}>
        <View>
          <Text style={styles.sheetTitle}>Why we ask this</Text>
          <Text style={styles.sheetBody}>
            Knowing your income sources helps FILEO apply the right tax rules and reliefs to your
            return.
          </Text>
          <Button label="Got it" onPress={() => setSheetVisible(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  option: {
    marginBottom: spacing.sm,
    borderRadius: radii.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  learnMore: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  continueButton: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
