/**
 * Shared upload flow for every place a document can be added (Upload
 * Documents, Deductions, the Documents tab):
 *
 *   tap Upload -> "Add a document" sheet (Choose a file / Take a photo)
 *   -> pick -> quick type/size check -> ("What is this document?" sheet,
 *   Documents tab only) -> upload -> onUploaded(document).
 *
 * Each upload slot (a platform, a deduction, the Documents tab) keys its
 * own state, so one screen can show several at once: idle, uploading, or
 * an error with a "Try again" when retrying can help (no connection /
 * upload failed — not for a file that's too large or the wrong type).
 *
 * ⚠️ No Figma design for the two sheets, the uploading row or the error
 * row — built from the existing BottomSheet, Button and caption styles.
 */
import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '../../constants/colors';
import { spacing, typography } from '../../constants/theme';
import {
  checkFile,
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  DocumentRecord,
  DocumentSource,
  PickedFile,
  pickFromFiles,
  takePhoto,
  uploadDocument,
} from '../../lib/documents';
import { CURRENT_TAX_YEAR } from '../../state/filingContext';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';

export type UploadSlotState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'error'; message: string; canRetry: boolean };

export type UploadRequest = {
  /** Which slot this upload fills, e.g. a platform name. */
  key: string;
  source: DocumentSource;
  /** A fixed category, or 'ask' to show the "What is this?" sheet. */
  category: DocumentCategory | 'ask';
  onUploaded: (document: DocumentRecord) => void;
};

const IDLE: UploadSlotState = { status: 'idle' };

// iOS can't present the file picker / camera while a sheet is still
// animating closed.
const waitForSheetToClose = () =>
  Platform.OS === 'ios' ? new Promise((resolve) => setTimeout(resolve, 400)) : Promise.resolve();

export function useDocumentUploader() {
  const [slots, setSlots] = useState<Record<string, UploadSlotState>>({});
  const [sourceRequest, setSourceRequest] = useState<UploadRequest | null>(null);
  const [categoryRequest, setCategoryRequest] = useState<{
    request: UploadRequest;
    file: PickedFile;
  } | null>(null);
  // The last failed attempt per slot, so "Try again" re-sends the same file.
  const lastAttempts = useRef<
    Record<string, { request: UploadRequest; file: PickedFile; category: DocumentCategory }>
  >({});

  const setSlot = useCallback((key: string, state: UploadSlotState) => {
    setSlots((prev) => ({ ...prev, [key]: state }));
  }, []);

  const run = useCallback(
    async (request: UploadRequest, file: PickedFile, category: DocumentCategory) => {
      lastAttempts.current[request.key] = { request, file, category };
      setSlot(request.key, { status: 'uploading' });
      const result = await uploadDocument(file, {
        category,
        source: request.source,
        taxYear: Number(CURRENT_TAX_YEAR),
      });
      if (result.error) {
        setSlot(request.key, {
          status: 'error',
          message: result.error.message,
          canRetry: result.error.code === 'network' || result.error.code === 'failed',
        });
        return;
      }
      delete lastAttempts.current[request.key];
      setSlot(request.key, IDLE);
      request.onUploaded(result.document);
    },
    [setSlot]
  );

  const choose = async (from: 'files' | 'camera') => {
    const request = sourceRequest;
    if (!request) {
      return;
    }
    setSourceRequest(null);
    await waitForSheetToClose();
    const picked = from === 'files' ? await pickFromFiles() : await takePhoto();
    if (picked.status === 'cancelled') {
      return;
    }
    if (picked.status === 'error') {
      setSlot(request.key, { status: 'error', message: picked.message, canRetry: false });
      return;
    }
    const problem = checkFile(picked.file);
    if (problem) {
      setSlot(request.key, { status: 'error', message: problem.message, canRetry: false });
      return;
    }
    if (request.category === 'ask') {
      setCategoryRequest({ request, file: picked.file });
      return;
    }
    await run(request, picked.file, request.category);
  };

  const chooseCategory = (category: DocumentCategory) => {
    const pending = categoryRequest;
    setCategoryRequest(null);
    if (pending) {
      run(pending.request, pending.file, category);
    }
  };

  const slot = (key: string): UploadSlotState => slots[key] ?? IDLE;

  const start = (request: UploadRequest) => {
    if (slot(request.key).status === 'uploading') {
      return;
    }
    setSlot(request.key, IDLE);
    setSourceRequest(request);
  };

  const retry = (key: string) => {
    const attempt = lastAttempts.current[key];
    if (attempt) {
      run(attempt.request, attempt.file, attempt.category);
    }
  };

  const clear = (key: string) => {
    delete lastAttempts.current[key];
    setSlot(key, IDLE);
  };

  const isAnyUploading = Object.values(slots).some((s) => s.status === 'uploading');

  const sheets: ReactNode = (
    <>
      <BottomSheet visible={sourceRequest !== null} onClose={() => setSourceRequest(null)}>
        <Text style={styles.sheetTitle}>Add a document</Text>
        <Text style={styles.sheetBody}>PDF, JPG, PNG or HEIC, up to 10 MB.</Text>
        <Button label="Choose a file" variant="dark" onPress={() => choose('files')} />
        <Button
          label="Take a photo"
          variant="secondary"
          onPress={() => choose('camera')}
          style={styles.sheetButtonSpacing}
        />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setSourceRequest(null)}
          style={styles.sheetButtonSpacing}
        />
      </BottomSheet>

      <BottomSheet visible={categoryRequest !== null} onClose={() => setCategoryRequest(null)}>
        <Text style={styles.sheetTitle}>What is this document?</Text>
        <Text style={styles.sheetBody}>This helps us file it in the right place.</Text>
        {DOCUMENT_CATEGORIES.map((category, index) => (
          <Pressable
            key={category.value}
            onPress={() => chooseCategory(category.value)}
            style={[styles.categoryRow, index === 0 && styles.categoryRowFirst]}
            accessibilityRole="button"
          >
            <Text style={styles.categoryLabel}>{category.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setCategoryRequest(null)}
          style={styles.sheetButtonSpacing}
        />
      </BottomSheet>
    </>
  );

  return { slot, start, retry, clear, isAnyUploading, sheets };
}

/** "Uploading…" with a spinner. Supabase's standard upload doesn't report
 * progress, so this is a loading state rather than a percentage. */
export function UploadingRow() {
  return (
    <View style={styles.statusRow} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.uploadingText}>Uploading…</Text>
    </View>
  );
}

/** The error under an upload slot, with "Try again" when that can help. */
export function UploadErrorRow({
  state,
  onRetry,
  style,
}: {
  state: UploadSlotState;
  onRetry: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (state.status !== 'error') {
    return null;
  }
  return (
    <View style={[styles.errorRow, style]} accessibilityLiveRegion="polite">
      <Text style={styles.errorText}>{state.message}</Text>
      {state.canRetry ? (
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text style={styles.retryLink}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  sheetButtonSpacing: {
    marginTop: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryRowFirst: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  categoryLabel: {
    ...typography.body,
    color: colors.textPrimary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  uploadingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  retryLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
});
