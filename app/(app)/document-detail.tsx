/**
 * Document detail — layout from the user's own screenshot (title/date, a
 * details card, a dark main action, a text action under it), now for one
 * of the user's uploaded documents, by `id`.
 *
 *  - Photos (JPG/PNG) show a preview.
 *  - "Open document" opens the file through a signed link that expires
 *    after a few minutes (never a public URL).
 *  - "Delete document" asks first (a sheet — no design), then removes both
 *    the file and its row, and returns to Documents. A document that's part
 *    of a submitted return can't be deleted (the database and storage rules
 *    refuse it); instead of Delete, a short note says which return it's in.
 *
 * ⚠️ No design for the loading / not-found states or the delete sheet —
 * built from the existing BottomSheet, Button and text styles.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  categoryLabel,
  deleteDocument,
  DocumentRecord,
  formatFileSize,
  getDocument,
  getDocumentLock,
  getDocumentUrl,
} from '../../lib/documents';
import { useFiling } from '../../state/filingContext';

const PREVIEWABLE_TYPES = ['image/jpeg', 'image/png'];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function typeLabel(mimeType: string) {
  return mimeType === 'application/pdf' ? 'PDF' : 'Image';
}

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { forgetDocument } = useFiling();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'missing' | 'error'>('loading');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Part of a submitted return? Then it can't be deleted.
  const [lockedYear, setLockedYear] = useState<number | null>(null);

  const load = async () => {
    if (!id) {
      setLoadState('missing');
      return;
    }
    setLoadState('loading');
    const result = await getDocument(id);
    if (result.error) {
      setLoadState('error');
      return;
    }
    if (!result.document) {
      setLoadState('missing');
      return;
    }
    setDocument(result.document);
    setLockedYear((await getDocumentLock(result.document.id))?.taxYear ?? null);
    setLoadState('loaded');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Photos get a preview, through the same short-lived signed link.
  useEffect(() => {
    if (!document || !PREVIEWABLE_TYPES.includes(document.mime_type)) {
      return;
    }
    let isMounted = true;
    getDocumentUrl(document).then((result) => {
      if (isMounted && result.url) {
        setPreviewUrl(result.url);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [document]);

  const handleOpen = async () => {
    if (!document || isOpening) {
      return;
    }
    setIsOpening(true);
    const result = await getDocumentUrl(document);
    setIsOpening(false);
    if (result.error) {
      setToastMessage(
        result.error.code === 'network'
          ? result.error.message
          : 'Couldn’t open this document. Please try again.'
      );
      return;
    }
    try {
      await Linking.openURL(result.url);
    } catch {
      setToastMessage('Couldn’t open this document. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!document || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    const { error } = await deleteDocument(document);
    setIsDeleting(false);
    if (error) {
      setDeleteError(
        error.code === 'network' || error.code === 'locked'
          ? error.message
          : 'Couldn’t delete this document. Please try again.'
      );
      return;
    }
    forgetDocument(document.id);
    setIsConfirmingDelete(false);
    setIsDeleted(true);
    setToastMessage('Document deleted.');
  };

  const backRow = (
    <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
      <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      <Text style={styles.backLabel}>Documents</Text>
    </Pressable>
  );

  if (loadState !== 'loaded' || !document) {
    return (
      <Screen>
        {backRow}
        {loadState === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.stateTitle}>
              {loadState === 'missing' ? 'Document not found' : 'Couldn’t load this document'}
            </Text>
            <Text style={styles.stateBody}>
              {loadState === 'missing'
                ? 'It may have been deleted.'
                : 'Check your connection and try again.'}
            </Text>
            {loadState === 'error' ? (
              <Button label="Try again" variant="secondary" onPress={load} style={styles.stateButton} />
            ) : null}
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      {backRow}

      <Text style={styles.title} numberOfLines={2}>
        {document.file_name}
      </Text>
      <Text style={styles.date}>Uploaded {formatDate(document.created_at)}</Text>

      {PREVIEWABLE_TYPES.includes(document.mime_type) ? (
        <View style={styles.preview}>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              contentFit="contain"
              // Don't keep copies of sensitive documents in the disk cache.
              cachePolicy="none"
              accessibilityLabel="Document preview"
            />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      ) : null}

      <Card style={styles.descriptionCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>{categoryLabel(document.category)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tax year</Text>
          <Text style={styles.detailValue}>{document.tax_year}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>File</Text>
          <Text style={styles.detailValue}>
            {typeLabel(document.mime_type)} · {formatFileSize(document.size_bytes)}
          </Text>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Open document"
          variant="dark"
          onPress={handleOpen}
          loading={isOpening}
          disabled={isDeleted}
        />
        {lockedYear !== null ? (
          <View style={styles.lockedRow}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.lockedText}>
              This document is part of your submitted {lockedYear} return, so it can&apos;t be
              deleted.
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setDeleteError(null);
              setIsConfirmingDelete(true);
            }}
            style={styles.deleteButton}
            hitSlop={8}
            disabled={isDeleted}
            accessibilityRole="button"
          >
            <Text style={styles.deleteLabel}>Delete document</Text>
          </Pressable>
        )}
      </View>

      <BottomSheet visible={isConfirmingDelete} onClose={() => setIsConfirmingDelete(false)}>
        <Text style={styles.sheetTitle}>Delete this document?</Text>
        <Text style={styles.sheetBody}>
          It will be permanently removed from your account. This can&apos;t be undone.
        </Text>
        {deleteError ? <Text style={styles.sheetError}>{deleteError}</Text> : null}
        <Button label="Delete" variant="dark" onPress={handleDelete} loading={isDeleting} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setIsConfirmingDelete(false)}
          style={styles.sheetButtonSpacing}
        />
      </BottomSheet>

      <Toast
        key={toastMessage ?? 'none'}
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => {
          setToastMessage(null);
          if (isDeleted) {
            router.back();
          }
        }}
      />
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
  preview: {
    height: 240,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  descriptionCard: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.md,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  lockedText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  deleteButton: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  deleteLabel: {
    ...typography.bodyStrong,
    color: colors.danger,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  stateTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stateBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stateButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  sheetTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sheetBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  sheetError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  sheetButtonSpacing: {
    marginTop: spacing.sm,
  },
});
