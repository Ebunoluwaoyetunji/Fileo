/**
 * Documents — the screen behind the bottom nav's "Documents" tab: every
 * document the user has uploaded (here, on Upload Documents or on
 * Deductions), loaded from their account (public.documents), newest first.
 * Reloads each time the tab is shown, so uploads from the filing flow
 * appear straight away, and still there after a reinstall or on another
 * phone.
 *
 * States:
 *  - loading / couldn't load (no design — spinner, and a "Try again");
 *  - empty (same shape as before, copy now about uploads) with an
 *    "Upload document" button;
 *  - populated: the user's own card design, one card per document
 *    (name, category, date, size), tapping through to document-detail.
 *
 * Uploading here asks "What is this document?" after the file is picked
 * (see useDocumentUploader), and files it under the current tax year.
 * While a draft return still needs documents (the server's own list), it
 * first asks "Is this for your {year} return?", listing them; choosing one
 * files the upload under that tax year and fills that slot of the draft.
 * ⚠️ No design for that sheet.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  UploadErrorRow,
  UploadingRow,
  useDocumentUploader,
} from '../../components/documents/useDocumentUploader';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { Screen } from '../../components/layout/Screen';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toast } from '../../components/ui/Toast';
import { useMissingItems } from '../../components/filing/FilingFlow';
import { colors } from '../../constants/colors';
import { radii, spacing, typography } from '../../constants/theme';
import {
  categoryLabel,
  DocumentRecord,
  formatFileSize,
  listDocuments,
} from '../../lib/documents';
import { describeMissingItem } from '../../lib/filings';
import { useFiling } from '../../state/filingContext';

const UPLOAD_KEY = 'documents-tab';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DocumentsScreen() {
  const uploader = useDocumentUploader();
  const { draft, addUploadedDocument } = useFiling();
  // Documents the draft return still needs, offered when uploading here.
  const { items: missingItems, recheck: recheckMissing } = useMissingItems(draft?.id);
  const slotOptions = (missingItems ?? []).flatMap((item) => {
    const details = describeMissingItem(item).document;
    return details ? [details] : [];
  });
  const [documents, setDocuments] = useState<DocumentRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listDocuments();
    setIsLoading(false);
    if (result.error) {
      setLoadError(result.error.message);
      return;
    }
    setLoadError(null);
    setDocuments(result.documents);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUpload = () => {
    uploader.start({
      key: UPLOAD_KEY,
      source: 'documents_tab',
      category: 'ask',
      ...(draft && slotOptions.length > 0
        ? { slotChoices: { taxYear: draft.taxYear, options: slotOptions }, taxYear: draft.taxYear }
        : {}),
      onUploaded: async (document, slotKey) => {
        setDocuments((prev) => [document, ...(prev ?? []).filter((d) => d.id !== document.id)]);
        if (!slotKey || !draft) {
          setToastMessage('Document uploaded.');
          return;
        }
        const { error } = await addUploadedDocument(slotKey, document.id);
        setToastMessage(
          error
            ? 'Document uploaded, but we couldn’t add it to your return. Check your connection, then upload it from your return.'
            : `Document uploaded and added to your ${draft.taxYear} return.`
        );
        recheckMissing();
      },
    });
  };

  const uploadState = uploader.slot(UPLOAD_KEY);
  const isUploading = uploadState.status === 'uploading';

  let body;
  if (documents === null && isLoading) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  } else if (documents === null) {
    body = (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Couldn&apos;t load your documents</Text>
        <Text style={styles.emptyBody}>{loadError ?? 'Please try again.'}</Text>
        <Button label="Try again" variant="secondary" onPress={load} style={styles.emptyButton} />
      </View>
    );
  } else if (documents.length === 0 && !isUploading) {
    body = (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="folder-outline" size={32} color={colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>No documents yet</Text>
        <Text style={styles.emptyBody}>
          Bank statements, payslips, invoices and receipts you upload are saved here, safely in
          your account.
        </Text>
        <Button
          label="Upload document"
          variant="dark"
          onPress={handleUpload}
          style={styles.emptyButton}
        />
        <UploadErrorRow state={uploadState} onRetry={() => uploader.retry(UPLOAD_KEY)} />
      </View>
    );
  } else {
    body = (
      <>
        <Text style={styles.subtitle}>Saved to your account</Text>
        <Button
          label="Upload document"
          variant="dark"
          onPress={handleUpload}
          loading={isUploading}
          style={styles.uploadButton}
        />
        <UploadErrorRow
          state={uploadState}
          onRetry={() => uploader.retry(UPLOAD_KEY)}
          style={styles.uploadError}
        />
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {isUploading ? (
            <Card style={styles.docCard}>
              <UploadingRow />
            </Card>
          ) : null}
          {(documents ?? []).map((document) => (
            <Pressable
              key={document.id}
              onPress={() =>
                router.push({ pathname: '/(app)/document-detail', params: { id: document.id } })
              }
              accessibilityRole="button"
            >
              <Card style={styles.docCard}>
                <View style={styles.docIconCircle}>
                  <Ionicons
                    name={document.mime_type.startsWith('image/') ? 'image-outline' : 'document-text-outline'}
                    size={22}
                    color={colors.primaryDark}
                  />
                </View>
                <View style={styles.docTextWrap}>
                  <Text style={styles.docTitle} numberOfLines={1}>
                    {document.file_name}
                  </Text>
                  <Text style={styles.docMeta} numberOfLines={1}>
                    {categoryLabel(document.category)} · {formatDate(document.created_at)} ·{' '}
                    {formatFileSize(document.size_bytes)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Card>
            </Pressable>
          ))}
        </ScrollView>
      </>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.title}>Documents</Text>
        {body}
      </View>

      <BottomTabBar active="documents" />

      <Toast
        key={toastMessage ?? 'none'}
        visible={toastMessage !== null}
        message={toastMessage ?? ''}
        onHide={() => setToastMessage(null)}
      />
      {uploader.sheets}
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
  uploadButton: {
    marginBottom: spacing.md,
  },
  uploadError: {
    marginTop: 0,
    marginBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyButton: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
});
