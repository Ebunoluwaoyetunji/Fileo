/**
 * "Other Nigerian Fintechs" — from the Figma frame reached by tapping
 * "Others" under Select Platform's Nigerian fintechs category: a searchable
 * bank list, multi-select. Selections write straight into FilingContext's
 * shared `selectedPlatforms` (the same field select-platform reads/writes),
 * so a chosen bank shows up there as a real name rather than a generic
 * "Others" placeholder.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { colors } from '../../constants/colors';
import { AUTO_PULL_MESSAGE, NIGERIAN_BANKS } from '../../constants/platforms';
import { radii, spacing, typography } from '../../constants/theme';
import { useFiling } from '../../state/filingContext';

export default function SelectBankScreen() {
  const { selectedPlatforms, togglePlatform } = useFiling();
  const [query, setQuery] = useState('');

  const filteredBanks = NIGERIAN_BANKS.filter((bank) =>
    bank.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Screen>
      <Text style={styles.title}>Other Nigerian Fintechs</Text>
      <Text style={styles.subtitle}>Select the banks that you received funds from</Text>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filteredBanks}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item: bank }) => {
          const isSelected = selectedPlatforms.includes(bank);
          return (
            <Pressable
              onPress={() => togglePlatform(bank)}
              style={[styles.row, isSelected && styles.rowSelected]}
            >
              <View style={styles.rowTopLine}>
                <Text style={styles.rowLabel}>{bank}</Text>
                <Ionicons
                  name={isSelected ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
              </View>
              {isSelected ? <Text style={styles.autoPullText}>{AUTO_PULL_MESSAGE}</Text> : null}
            </Pressable>
          );
        }}
      />

      <Button label="Continue" onPress={() => router.back()} style={styles.continueButton} />
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
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing.sm + 4,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  rowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  autoPullText: {
    ...typography.caption,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  continueButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
