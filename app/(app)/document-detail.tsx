/**
 * Document detail — from the user's own screenshot: a single document's
 * title/date, a description card, Download PDF, and Share.
 *
 * Only one document exists in this prototype (MOCK_TAX_CLEARANCE_CERTIFICATE
 * — ⚠️ illustrative, see filingContext.tsx), so this screen doesn't take a
 * document id param; it just renders that one. Download/Share are both
 * mock-only (a toast, same pattern as Confirmation's "Download Summary")
 * since there's no real PDF to produce or share sheet to open.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import { MOCK_TAX_CLEARANCE_CERTIFICATE } from '../../state/filingContext';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DocumentDetailScreen() {
  const [showToast, setShowToast] = useState<string | null>(null);

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backLabel}>Documents</Text>
      </Pressable>

      <Text style={styles.title}>{MOCK_TAX_CLEARANCE_CERTIFICATE.title}</Text>
      <Text style={styles.date}>{formatDate(MOCK_TAX_CLEARANCE_CERTIFICATE.issuedAt)}</Text>

      <Card style={styles.descriptionCard}>
        <Text style={styles.descriptionText}>{MOCK_TAX_CLEARANCE_CERTIFICATE.description}</Text>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Download PDF"
          variant="dark"
          onPress={() => setShowToast('Downloading a PDF isn’t available in this preview yet.')}
        />
        <Pressable
          onPress={() => setShowToast('Sharing isn’t available in this preview yet.')}
          style={styles.shareButton}
          hitSlop={8}
        >
          <Text style={styles.shareLabel}>Share</Text>
        </Pressable>
      </View>

      <Toast visible={!!showToast} message={showToast ?? ''} onHide={() => setShowToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignSelf: 'flex-start',
  },
  backLabel: {
    ...typography.body,
    color: colors.textPrimary,
    marginLeft: spacing.xs / 2,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  date: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  descriptionCard: {
    marginBottom: spacing.xl,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    gap: spacing.md,
  },
  shareButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  shareLabel: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
});
