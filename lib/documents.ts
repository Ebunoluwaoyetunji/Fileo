/**
 * The user's uploaded documents: files in the private "documents" storage
 * bucket, each described by a row in public.documents (see
 * supabase/migrations/20260924003000_documents_storage.sql).
 *
 * These are sensitive (bank statements, payslips, receipts), so:
 *  - files live at {user_id}/{random id}.{ext}; the original file name is
 *    only kept in the row, for display;
 *  - files are only ever viewed through signed URLs that expire after a
 *    few minutes, never public URLs;
 *  - nothing here logs file contents, file names or URLs.
 *
 * Upload order: file first, then its row. If the row can't be added, the
 * file is deleted again so nothing is left orphaned in storage.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export const DOCUMENTS_BUCKET = 'documents';
/** Must match the bucket's file_size_limit in the migration. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
/** How long a link to view a document stays valid. */
export const SIGNED_URL_SECONDS = 5 * 60;

export type DocumentCategory = 'bank_statement' | 'payslip' | 'invoice' | 'receipt' | 'other';
export type DocumentSource = 'upload_step' | 'deductions' | 'documents_tab';

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: 'bank_statement', label: 'Bank statement' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
];

export function categoryLabel(category: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? 'Other';
}

export type DocumentRecord = {
  id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  category: DocumentCategory;
  tax_year: number;
  source: DocumentSource;
  created_at: string;
};

/** A file the user picked, not uploaded yet. */
export type PickedFile = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number | null;
};

export type PickResult =
  | { status: 'picked'; file: PickedFile }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export type DocumentErrorCode =
  | 'too_large'
  | 'wrong_type'
  | 'network'
  | 'session_missing'
  | 'failed';

export type DocumentError = { code: DocumentErrorCode; message: string };

export const DOCUMENT_ERROR_MESSAGES: Record<DocumentErrorCode, string> = {
  too_large: 'This file is too large. Choose one under 10 MB.',
  wrong_type: 'This file type isn’t supported. Choose a PDF, JPG, PNG or HEIC.',
  network: 'No connection. Check your internet and try again.',
  session_missing: 'Your session has expired. Please sign in again.',
  failed: 'Upload failed. Please try again.',
};

const docError = (code: DocumentErrorCode): DocumentError => ({
  code,
  message: DOCUMENT_ERROR_MESSAGES[code],
});

// Allowed types (same list as the bucket) and the extension each is stored
// under.
const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heic',
};
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
};
export const ALLOWED_MIME_TYPES = Object.keys(EXTENSION_BY_MIME);

/** The file's type, from what the picker reported or else its extension;
 * null if it isn't one we accept. */
export function resolveMimeType(file: Pick<PickedFile, 'name' | 'mimeType'>): string | null {
  const reported = file.mimeType?.toLowerCase().split(';')[0].trim();
  if (reported === 'image/jpg' || reported === 'image/pjpeg') {
    return 'image/jpeg';
  }
  if (reported && EXTENSION_BY_MIME[reported]) {
    return reported;
  }
  if (reported && reported !== 'application/octet-stream') {
    return null;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? null;
}

/** Checks the type and (when known) size before uploading. The server
 * enforces both again. */
export function checkFile(file: PickedFile): DocumentError | null {
  if (!resolveMimeType(file)) {
    return docError('wrong_type');
  }
  if (file.size !== null && file.size > MAX_DOCUMENT_BYTES) {
    return docError('too_large');
  }
  return null;
}

// ---------------------------------------------------------------------------
// Picking
// ---------------------------------------------------------------------------

export async function pickFromFiles(): Promise<PickResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) {
      return { status: 'cancelled' };
    }
    const asset = result.assets[0];
    return {
      status: 'picked',
      file: {
        uri: asset.uri,
        name: asset.name || 'Document',
        mimeType: asset.mimeType ?? null,
        size: typeof asset.size === 'number' ? asset.size : null,
      },
    };
  } catch {
    return { status: 'error', message: 'Couldn’t open your files. Please try again.' };
  }
}

export async function takePhoto(): Promise<PickResult> {
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return {
        status: 'error',
        message: 'Allow camera access in your phone’s settings to take a photo.',
      };
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) {
      return { status: 'cancelled' };
    }
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'jpg';
    return {
      status: 'picked',
      file: {
        uri: asset.uri,
        name: asset.fileName || `Photo ${new Date().toISOString().slice(0, 10)}.${extension}`,
        mimeType,
        size: typeof asset.fileSize === 'number' ? asset.fileSize : null,
      },
    };
  } catch {
    return { status: 'error', message: 'Couldn’t open the camera. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Upload / list / view / delete
// ---------------------------------------------------------------------------

function randomId(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  // Fallback where crypto.randomUUID isn't available (React Native): a v4
  // UUID. The path only has to be unique; access is controlled by the
  // storage policies, not by the name being hard to guess.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const e = error as { name?: string; message?: string; originalError?: unknown };
  if (e.name === 'StorageUnknownError') {
    return true;
  }
  return /network request failed|failed to fetch|fetch failed|networkerror|load failed/i.test(
    e.message ?? ''
  );
}

/** Maps a Storage upload error to what we tell the user. */
function uploadErrorFor(error: unknown): DocumentError {
  if (isNetworkError(error)) {
    return docError('network');
  }
  // Storage answers HTTP 400 with the specific reason in statusCode/code,
  // e.g. "413" / EntityTooLarge, "415" / InvalidMimeType.
  const e = error as { statusCode?: string; code?: string; message?: string };
  if (e.statusCode === '413' || e.code === 'EntityTooLarge') {
    return docError('too_large');
  }
  if (e.statusCode === '415' || e.code === 'InvalidMimeType') {
    return docError('wrong_type');
  }
  return docError('failed');
}

export type UploadOptions = {
  category: DocumentCategory;
  taxYear: number;
  source: DocumentSource;
};

export type UploadResult =
  | { document: DocumentRecord; error: null }
  | { document: null; error: DocumentError };

export async function uploadDocument(file: PickedFile, options: UploadOptions): Promise<UploadResult> {
  const mimeType = resolveMimeType(file);
  if (!mimeType) {
    return { document: null, error: docError('wrong_type') };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { document: null, error: docError('session_missing') };
  }

  // Supabase's recommended way to upload from React Native: read the file
  // into an ArrayBuffer (a Blob built from a local file URI often arrives
  // empty) and pass the content type explicitly.
  let body: ArrayBuffer;
  try {
    body = await fetch(file.uri).then((response) => response.arrayBuffer());
  } catch {
    return { document: null, error: docError('failed') };
  }
  if (body.byteLength === 0) {
    return { document: null, error: docError('failed') };
  }
  if (body.byteLength > MAX_DOCUMENT_BYTES) {
    return { document: null, error: docError('too_large') };
  }

  // 1. The file.
  const storagePath = `${userId}/${randomId()}.${EXTENSION_BY_MIME[mimeType]}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, body, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return { document: null, error: uploadErrorFor(uploadError) };
  }

  // 2. Its row.
  const { data, error: insertError } = await supabase
    .from('documents')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      file_name: file.name.trim().slice(0, 255) || 'Document',
      mime_type: mimeType,
      size_bytes: body.byteLength,
      category: options.category,
      tax_year: options.taxYear,
      source: options.source,
    })
    .select()
    .single();
  if (insertError || !data) {
    // Don't leave the file behind without a row.
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    return {
      document: null,
      error: docError(isNetworkError(insertError) ? 'network' : 'failed'),
    };
  }
  return { document: data as DocumentRecord, error: null };
}

/** The user's documents, newest first. */
export async function listDocuments(): Promise<
  { documents: DocumentRecord[]; error: null } | { documents: null; error: DocumentError }
> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    return { documents: null, error: docError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { documents: (data ?? []) as DocumentRecord[], error: null };
}

export async function getDocument(
  id: string
): Promise<{ document: DocumentRecord | null; error: DocumentError | null }> {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).maybeSingle();
  if (error) {
    return { document: null, error: docError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { document: (data as DocumentRecord | null) ?? null, error: null };
}

/** A link to view the file that stops working after SIGNED_URL_SECONDS. */
export async function getDocumentUrl(
  document: Pick<DocumentRecord, 'storage_path'>
): Promise<{ url: string; error: null } | { url: null; error: DocumentError }> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    return { url: null, error: docError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { url: data.signedUrl, error: null };
}

/**
 * Deletes the file, then its row. File first: if the row then fails to
 * delete, trying again is safe (removing an already-removed file is a
 * no-op), whereas the other order could leave a file nobody can see.
 */
export async function deleteDocument(
  document: Pick<DocumentRecord, 'id' | 'storage_path'>
): Promise<{ error: DocumentError | null }> {
  const { error: removeError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([document.storage_path]);
  if (removeError) {
    return { error: docError(isNetworkError(removeError) ? 'network' : 'failed') };
  }
  const { error: rowError } = await supabase.from('documents').delete().eq('id', document.id);
  if (rowError) {
    return { error: docError(isNetworkError(rowError) ? 'network' : 'failed') };
  }
  return { error: null };
}

/** Deletes a document by id (used when a replaced file's row isn't loaded). */
export async function deleteDocumentById(id: string): Promise<{ error: DocumentError | null }> {
  const { document, error } = await getDocument(id);
  if (error) {
    return { error };
  }
  if (!document) {
    return { error: null };
  }
  return deleteDocument(document);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
