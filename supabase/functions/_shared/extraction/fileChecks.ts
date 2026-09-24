/**
 * Checks on the file itself, before any provider is paid to read it:
 * supported type, really that type, not too big, not password-protected,
 * not too many pages. Each failure is 'unreadable' with a clear code, and the
 * user can still type their income.
 */
import { EncryptedPDFError, PDFDocument } from 'npm:pdf-lib@1.17.1';
import { ExtractionError, type SupportedMimeType } from './types.ts';

/** Most PDF pages we'll send. A page costs roughly 3,000–7,000 input tokens
 * (text plus the page image), so this caps both cost and reading time. */
export const MAX_PDF_PAGES = 20;
/** The Anthropic API takes images up to 10 MB once base64-encoded, i.e.
 * about 7.5 MB of file. Uploads themselves are capped at 10 MB. */
export const MAX_IMAGE_BYTES = Math.floor(7.5 * 1024 * 1024);

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/** Does the file declare encryption (an "/Encrypt" key)? */
function hasEncryptEntry(bytes: Uint8Array): boolean {
  const text = new TextDecoder('latin1').decode(bytes);
  return /\/Encrypt[\s/<\d]/.test(text);
}

export interface CheckedFile {
  mimeType: SupportedMimeType;
  pageCount: number | null;
}

export async function checkFile(bytes: Uint8Array, mimeType: string): Promise<CheckedFile> {
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    // The Anthropic API reads JPEG, PNG, GIF and WebP only. Converting HEIC
    // on the server would need an image codec we don't bundle, so HEIC
    // photos are refused with a clear message instead.
    throw new ExtractionError('unsupported_type', 'heic');
  }
  if (bytes.byteLength === 0) {
    throw new ExtractionError('corrupt_file', 'empty file');
  }

  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    const ok =
      mimeType === 'image/jpeg'
        ? startsWith(bytes, [0xff, 0xd8, 0xff])
        : startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    if (!ok) {
      throw new ExtractionError('corrupt_file', 'image signature');
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new ExtractionError('file_too_large', 'image over the provider limit');
    }
    return { mimeType, pageCount: 1 };
  }

  if (mimeType !== 'application/pdf') {
    throw new ExtractionError('unsupported_type', 'mime type');
  }
  if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
    // "%PDF"
    throw new ExtractionError('corrupt_file', 'pdf signature');
  }
  // Providers can't read encrypted PDFs (Anthropic: "no
  // passwords/encryption"). Bank statements are often locked with a
  // password; the user can save an unlocked copy and upload that. pdf-lib
  // can open the structure of an encrypted file (ignoreEncryption) and tell
  // us; some encryption types stop it parsing at all, so an /Encrypt entry
  // in a file it can't parse counts too.
  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    if (pdf.isEncrypted) {
      throw new ExtractionError('password_protected', 'encrypted pdf');
    }
    pageCount = pdf.getPageCount();
  } catch (error) {
    if (error instanceof ExtractionError) {
      throw error;
    }
    if (error instanceof EncryptedPDFError || hasEncryptEntry(bytes)) {
      throw new ExtractionError('password_protected', 'encrypted pdf');
    }
    throw new ExtractionError('corrupt_file', 'pdf could not be parsed');
  }
  if (pageCount < 1) {
    throw new ExtractionError('corrupt_file', 'pdf has no pages');
  }
  if (pageCount > MAX_PDF_PAGES) {
    throw new ExtractionError('too_many_pages', `pdf has more than ${MAX_PDF_PAGES} pages`);
  }
  return { mimeType: 'application/pdf', pageCount };
}
