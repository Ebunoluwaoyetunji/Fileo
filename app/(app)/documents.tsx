/**
 * Documents — the screen behind the bottom nav's "Documents" tab, which
 * (like "File" before it) previously had no screen or onPress behind it.
 *
 * Two states, matching whether the user has any completed filing:
 *  - empty (no design given — built to fit the app's existing empty-state
 *    pattern, same shape as filing-history.tsx's not-started state):
 *    "No documents yet" + a way back to filing.
 *  - populated (the user's own design, for one specific document):
 *    ⚠️ there's no real document-generation pipeline — nothing here can
 *    produce a real tax clearance certificate from a filing. FilingContext
 *    only ever produces 'Submitted' filings (awaiting review), and a
 *    certificate is realistically something you'd only get once a filing
 *    is fully 'Filed'. Rather than fabricate one for the real (still
 *    "Submitted") entry, this list is driven by MOCK_PRIOR_FILING — the
 *    same illustrative already-processed past filing shown on the Filing
 *    tab's history state — paired with MOCK_TAX_CLEARANCE_CERTIFICATE
 *    (see filingContext.tsx). The *trigger* for showing this state is
 *    still real: filingHistory.length > 0, i.e. the user has actually
 *    completed at least one filing.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Card } from '../../components/ui/Card';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import { MOCK_TAX_CLEARANCE_CERTIFICATE, useFiling } from '../../state/filingContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DocumentsScreen() {
  const { filingHistory } = useFiling();
  const hasFilings = filingHistory.length > 0;

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Documents</Text>

        {hasFilings ? (
          <>
            <Text style={styles.subtitle}>Available to download</Text>
            <Pressable
              onPress={() => router.push('/(app)/document-detail')}
              accessibilityRole="button"
            >
              <Card style={styles.docCard}>
                <View style={styles.docIconCircle}>
                  <Ionicons name="document-text-outline" size={22} color={colors.primaryDark} />
                </View>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docTitle}>{MOCK_TAX_CLEARANCE_CERTIFICATE.title}</Text>
                  <Text style={styles.docMeta}>
                    Issued {formatDate(MOCK_TAX_CLEARANCE_CERTIFICATE.issuedAt)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Card>
            </Pressable>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="folder-outline" size={32} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyBody}>
              Once a filing is complete, documents like your tax clearance certificate will show up
              here.
            </Text>
          </View>
        )}
      </View>

      <BottomTabBar active="documents" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.display,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTextWrap: {
    flex: 1,
  },
  docTitle: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  docMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
