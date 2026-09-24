/**
 * The user's filings in Supabase (see supabase/migrations/20260924120000_filings.sql):
 * a draft in progress and their submitted history.
 *
 * Money is whole kobo in the database and naira in the app; the conversion
 * happens only here. Nothing here logs amounts or personal data.
 */
import type { Href } from 'expo-router';
import { DEDUCTION_DEFINITIONS } from '../constants/deductions';
import { platformDocumentCategory, platformDocumentLabel } from '../constants/platforms';
import type { DocumentCategory } from './documents';
import { supabase } from './supabase';

export type FilingStatus = 'draft' | 'submitted' | 'processing' | 'completed' | 'rejected';

export type FilingStep =
  | 'select_platform'
  | 'upload_documents'
  | 'income_summary'
  | 'deductions'
  | 'return_review';

export const FILING_STEPS: FilingStep[] = [
  'select_platform',
  'upload_documents',
  'income_summary',
  'deductions',
  'return_review',
];

/** Where each saved step resumes. */
export const STEP_ROUTES: Record<FilingStep, Href> = {
  select_platform: '/(app)/select-platform',
  upload_documents: '/(app)/upload-documents',
  income_summary: '/(app)/income-summary',
  deductions: '/(app)/deductions',
  return_review: '/(app)/return-review',
};

export function stepIndex(step: FilingStep): number {
  return FILING_STEPS.indexOf(step);
}

/** The tax year being filed now: the previous calendar year (2025 during 2026),
 * by the device's own date. */
export function currentTaxYear(now: Date = new Date()): number {
  return now.getFullYear() - 1;
}

export type IncomeSource = {
  id: string;
  label: string;
  /** Naira. */
  amount: number;
};

export type Deduction = {
  id: string;
  label: string;
  /** Naira. */
  amount: number;
};

export type Filing = {
  id: string;
  taxYear: number;
  status: FilingStatus;
  currentStep: FilingStep;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  /** Selected platforms / banks, in the order chosen. */
  platforms: string[];
  /** Only the sources whose amount has been confirmed. */
  incomeSources: IncomeSource[];
  deductions: Deduction[];
  /** App slot key (platform name, or deductionDocumentKey(type)) -> document id.
   * Empty slots (e.g. the document was deleted) are left out. */
  documentIdsByKey: Record<string, string>;
  totalIncome: number;
  totalDeductions: number;
};

export type FilingErrorCode =
  | 'network'
  | 'not_draft'
  | 'incomplete'
  | 'already_filed'
  | 'not_found'
  | 'failed';

/** One thing still missing before a draft can be submitted — the server's
 * own list (get_filing_missing_items / submit_filing), so the app and the
 * server never disagree about what "complete" means. */
export type MissingItem =
  | { type: 'income_sources' }
  | { type: 'income_amount'; platform: string }
  | { type: 'platform_document'; platform: string }
  | { type: 'deduction_document'; deduction_type: string }
  | { type: 'review' };

export type FilingError = { code: FilingErrorCode; message: string; missingItems?: MissingItem[] };

const MESSAGES: Record<FilingErrorCode, string> = {
  network: 'Couldn’t save. Check your connection and try again.',
  not_draft: 'This return has already been submitted and can’t be changed.',
  incomplete: 'Some steps aren’t finished yet. Go back and complete them, then submit.',
  already_filed: 'You’ve already filed for this tax year.',
  not_found: 'This filing couldn’t be found.',
  failed: 'Something went wrong. Please try again.',
};

const filingError = (code: FilingErrorCode, missingItems?: MissingItem[]): FilingError => ({
  code,
  message: MESSAGES[code],
  ...(missingItems ? { missingItems } : {}),
});

function isNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return /network request failed|failed to fetch|fetch failed|networkerror|load failed/i.test(message);
}

// Platform slots are stored as 'platform:<name>'; the app keys them by name.
const toSlot = (key: string) => (key.startsWith('deduction:') ? key : `platform:${key}`);
const fromSlot = (slot: string) =>
  slot.startsWith('platform:') ? slot.slice('platform:'.length) : slot;

export const nairaToKobo = (naira: number) => Math.round(naira * 100);
export const koboToNaira = (kobo: number) => kobo / 100;

type FilingRow = {
  id: string;
  tax_year: number;
  status: FilingStatus;
  current_step: FilingStep;
  reference: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  filing_income_sources: { platform: string; amount_kobo: number | null; position: number }[];
  filing_deductions: { deduction_type: string; amount_kobo: number }[];
  filing_documents: { slot: string; document_id: string | null }[];
};

const FILING_SELECT =
  'id, tax_year, status, current_step, reference, created_at, updated_at, submitted_at, ' +
  'filing_income_sources(platform, amount_kobo, position), ' +
  'filing_deductions(deduction_type, amount_kobo), ' +
  'filing_documents(slot, document_id)';

function toFiling(row: FilingRow): Filing {
  const sources = [...(row.filing_income_sources ?? [])].sort((a, b) => a.position - b.position);
  const incomeSources = sources
    .filter((s) => s.amount_kobo !== null)
    .map((s) => ({ id: `income-${s.platform}`, label: s.platform, amount: koboToNaira(s.amount_kobo as number) }));
  const deductions = (row.filing_deductions ?? []).map((d) => ({
    id: d.deduction_type,
    label: DEDUCTION_DEFINITIONS.find((def) => def.id === d.deduction_type)?.label ?? d.deduction_type,
    amount: koboToNaira(d.amount_kobo),
  }));
  const documentIdsByKey: Record<string, string> = {};
  (row.filing_documents ?? []).forEach((d) => {
    if (d.document_id) {
      documentIdsByKey[fromSlot(d.slot)] = d.document_id;
    }
  });
  return {
    id: row.id,
    taxYear: row.tax_year,
    status: row.status,
    currentStep: row.current_step,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    platforms: sources.map((s) => s.platform),
    incomeSources,
    deductions,
    documentIdsByKey,
    totalIncome: incomeSources.reduce((sum, s) => sum + s.amount, 0),
    totalDeductions: deductions.reduce((sum, d) => sum + d.amount, 0),
  };
}

/** All of the user's filings (drafts and history), newest first. */
export async function listFilings(): Promise<
  { filings: Filing[]; error: null } | { filings: null; error: FilingError }
> {
  const { data, error } = await supabase
    .from('filings')
    .select(FILING_SELECT)
    .order('created_at', { ascending: false });
  if (error) {
    return { filings: null, error: filingError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { filings: (data as unknown as FilingRow[]).map(toFiling), error: null };
}

export async function getFiling(
  id: string
): Promise<{ filing: Filing | null; error: FilingError | null }> {
  const { data, error } = await supabase.from('filings').select(FILING_SELECT).eq('id', id).maybeSingle();
  if (error) {
    return { filing: null, error: filingError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { filing: data ? toFiling(data as unknown as FilingRow) : null, error: null };
}

async function findDraft(taxYear: number) {
  return supabase
    .from('filings')
    .select(FILING_SELECT)
    .eq('tax_year', taxYear)
    .eq('status', 'draft')
    .maybeSingle();
}

/**
 * The draft for this tax year: the existing one if there is one (created on
 * another device, say), otherwise a new one. Never creates a second draft
 * (the database refuses one anyway).
 */
export async function getOrCreateDraft(
  taxYear: number
): Promise<{ filing: Filing; error: null } | { filing: null; error: FilingError }> {
  const existing = await findDraft(taxYear);
  if (existing.error) {
    return { filing: null, error: filingError(isNetworkError(existing.error) ? 'network' : 'failed') };
  }
  if (existing.data) {
    return { filing: toFiling(existing.data as unknown as FilingRow), error: null };
  }
  const { data, error } = await supabase
    .from('filings')
    .insert({ tax_year: taxYear })
    .select(FILING_SELECT)
    .single();
  if (!error && data) {
    return { filing: toFiling(data as unknown as FilingRow), error: null };
  }
  if (error?.code === '23505') {
    // Created elsewhere in the meantime: resume that one.
    const again = await findDraft(taxYear);
    if (again.data) {
      return { filing: toFiling(again.data as unknown as FilingRow), error: null };
    }
  }
  if (error?.code === '42501') {
    // The insert policy refuses a draft for a year that's already submitted.
    return { filing: null, error: filingError('already_filed') };
  }
  return { filing: null, error: filingError(isNetworkError(error) ? 'network' : 'failed') };
}

export type ProgressUpdate = {
  platforms?: string[];
  /** Naira, by platform. Platforms without a confirmed amount are saved empty. */
  incomeByPlatform?: Record<string, number>;
  deductions?: Deduction[];
  /** App slot key -> document id (null empties the slot). */
  documents?: Record<string, string | null>;
};

/** Saves one step (all-or-nothing, on the server) and where to resume. */
export async function saveFilingProgress(
  filingId: string,
  currentStep: FilingStep,
  update: ProgressUpdate
): Promise<{ error: FilingError | null }> {
  const { error } = await supabase.rpc('save_filing_progress', {
    p_filing_id: filingId,
    p_current_step: currentStep,
    p_income_sources: update.platforms
      ? update.platforms.map((platform) => {
          const naira = update.incomeByPlatform?.[platform];
          return { platform, amount_kobo: naira === undefined ? null : nairaToKobo(naira) };
        })
      : null,
    p_deductions: update.deductions
      ? update.deductions.map((d) => ({ deduction_type: d.id, amount_kobo: nairaToKobo(d.amount) }))
      : null,
    p_documents: update.documents
      ? Object.entries(update.documents).map(([key, documentId]) => ({
          slot: toSlot(key),
          document_id: documentId,
        }))
      : null,
  });
  if (error) {
    if (error.hint === 'not_draft') {
      return { error: filingError('not_draft') };
    }
    return { error: filingError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { error: null };
}

/** Links one uploaded document into a slot of the draft right away. */
export async function linkFilingDocument(
  filingId: string,
  currentStep: FilingStep,
  key: string,
  documentId: string | null
): Promise<{ error: FilingError | null }> {
  return saveFilingProgress(filingId, currentStep, { documents: { [key]: documentId } });
}

/** Submits the draft: the server checks it and returns the reference. */
export async function submitFiling(
  filingId: string
): Promise<
  | { reference: string; submittedAt: string; error: null }
  | { reference: null; submittedAt: null; error: FilingError }
> {
  const { data, error } = await supabase.rpc('submit_filing', { p_filing_id: filingId });
  if (error) {
    const code: FilingErrorCode =
      error.hint === 'incomplete'
        ? 'incomplete'
        : error.hint === 'not_draft'
          ? 'not_draft'
          : error.hint === 'not_found'
            ? 'not_found'
            : isNetworkError(error)
              ? 'network'
              : 'failed';
    const missingItems = code === 'incomplete' ? parseMissingItems(error.details) : undefined;
    return { reference: null, submittedAt: null, error: filingError(code, missingItems) };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { reference: string; submitted_at: string } | null;
  if (!row?.reference) {
    return { reference: null, submittedAt: null, error: filingError('failed') };
  }
  return { reference: row.reference, submittedAt: row.submitted_at, error: null };
}

function parseMissingItems(details: string | null | undefined): MissingItem[] {
  try {
    const parsed = JSON.parse(details ?? '[]');
    return Array.isArray(parsed) ? (parsed as MissingItem[]) : [];
  } catch {
    return [];
  }
}

/** What's still missing from the draft, from the server's own rules. */
export async function getMissingItems(
  filingId: string
): Promise<{ items: MissingItem[]; error: null } | { items: null; error: FilingError }> {
  const { data, error } = await supabase.rpc('get_filing_missing_items', { p_filing_id: filingId });
  if (error) {
    return { items: null, error: filingError(isNetworkError(error) ? 'network' : 'failed') };
  }
  return { items: Array.isArray(data) ? (data as MissingItem[]) : [], error: null };
}

export type MissingItemDetails = {
  /** Stable id for lists. */
  id: string;
  /** Plain-English line, e.g. "Paystack statement not uploaded". */
  label: string;
  /** The step that fixes it. */
  step: FilingStep;
  /** What to highlight on that step (a platform name or a deduction type). */
  focus?: string;
  /** For a missing document: the slot it fills, what it's called and how
   * it's filed in Documents. */
  document?: { slotKey: string; name: string; category: DocumentCategory };
};

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export function describeMissingItem(item: MissingItem): MissingItemDetails {
  switch (item.type) {
    case 'income_sources':
      return { id: 'income_sources', label: 'No income sources selected', step: 'select_platform' };
    case 'income_amount':
      return {
        id: `income_amount:${item.platform}`,
        label: `Income amount missing for ${item.platform}`,
        step: 'income_summary',
        focus: item.platform,
      };
    case 'platform_document':
      return {
        id: `platform:${item.platform}`,
        label: `${platformDocumentLabel(item.platform)} not uploaded`,
        step: 'upload_documents',
        focus: item.platform,
        document: {
          slotKey: item.platform,
          name: platformDocumentLabel(item.platform),
          category: platformDocumentCategory(item.platform),
        },
      };
    case 'deduction_document': {
      const definition = DEDUCTION_DEFINITIONS.find((d) => d.id === item.deduction_type);
      const name = capitalize(definition?.documentLabel ?? 'Deduction document');
      return {
        id: `deduction:${item.deduction_type}`,
        label: `${name} not uploaded`,
        step: 'deductions',
        focus: item.deduction_type,
        document: {
          slotKey: `deduction:${item.deduction_type}`,
          name,
          category: definition?.documentCategory ?? 'other',
        },
      };
    }
    case 'review':
    default:
      return { id: 'review', label: 'Deductions not confirmed yet', step: 'deductions' };
  }
}

/** How a status reads to the user. */
export const STATUS_LABELS: Record<FilingStatus, string> = {
  draft: 'In progress',
  submitted: 'Submitted',
  processing: 'Processing',
  completed: 'Filed',
  rejected: 'Rejected',
};
