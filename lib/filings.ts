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

/** Where an income amount came from: typed by the user, or an AI suggestion
 * from their statement that they accepted. */
export type AmountSource = 'manual' | 'ai';

export type IncomeSource = {
  id: string;
  label: string;
  /** Whole kobo; null until entered. */
  amountKobo: number | null;
  amountSource: AmountSource | null;
  /** An AI-suggested amount from the uploaded statement (server-written). */
  aiSuggestedKobo: number | null;
};

export type Deduction = {
  id: string;
  label: string;
  /** What the user paid (rent, contributions, premiums), whole kobo; null
   * until entered. The tax rules decide how much of it is allowed. */
  amountPaidKobo: number | null;
};

export type ReliefLine = {
  /** 'cra', 'pension', 'nhf', 'life_assurance' or 'rent'. */
  code: string;
  claimedKobo: number | null;
  appliedKobo: number;
  status: 'applied' | 'capped' | 'not_applied';
  /** Plain-English note from the rules, e.g. why it wasn't applied. */
  note: string | null;
};

export type TaxBand = {
  fromKobo: number;
  widthKobo: number | null;
  rateBp: number;
  taxableKobo: number;
  taxKobo: number;
};

/** The server's calculation (filing_tax_calculations). Display only. */
export type TaxCalculation = {
  rulesVersion: string;
  rulesName: string | null;
  taxYear: number;
  grossIncomeKobo: number;
  businessExpensesKobo: number;
  incomeAfterExpensesKobo: number;
  reliefs: ReliefLine[];
  totalReliefsKobo: number;
  taxableIncomeKobo: number;
  bands: TaxBand[];
  bandTaxKobo: number;
  minimumTaxKobo: number | null;
  minimumTaxApplied: boolean;
  taxDueKobo: number;
  /** Tax on the same income with none of the user's deductions. */
  taxWithoutDeductionsKobo: number;
  calculatedAt: string;
  isFinal: boolean;
};

/** How each relief line from the server reads. */
export const RELIEF_LABELS: Record<string, string> = {
  cra: 'Consolidated relief allowance',
  pension: 'Pension contributions',
  nhf: 'National Housing Fund (NHF)',
  life_assurance: 'Life assurance premium',
  rent: 'Rent relief',
};

/** What the user's deductions saved, per the server's figures. */
export const taxSavedKobo = (calc: TaxCalculation) =>
  Math.max(calc.taxWithoutDeductionsKobo - calc.taxDueKobo, 0);

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
  /** One per selected platform (amount null until entered). */
  incomeSources: IncomeSource[];
  businessExpensesKobo: number;
  incomeConfirmedAt: string | null;
  deductions: Deduction[];
  /** App slot key (platform name, or deductionDocumentKey(type)) -> document id.
   * Empty slots (e.g. the document was deleted) are left out. */
  documentIdsByKey: Record<string, string>;
  /** Sum of entered income, whole kobo. */
  totalIncomeKobo: number;
  taxCalculation: TaxCalculation | null;
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
  | { type: 'income_unconfirmed' }
  | { type: 'deduction_amount'; deduction_type: string }
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

type CalcRow = {
  tax_year: number;
  rules_version: string;
  gross_income_kobo: number;
  business_expenses_kobo: number;
  income_after_expenses_kobo: number;
  reliefs: { code: string; claimed_kobo: number | null; applied_kobo: number; status: ReliefLine['status']; note: string | null }[];
  total_reliefs_kobo: number;
  taxable_income_kobo: number;
  bands: { from_kobo: number; width_kobo: number | null; rate_bp: number; taxable_kobo: number; tax_kobo: number }[];
  band_tax_kobo: number;
  minimum_tax_kobo: number | null;
  minimum_tax_applied: boolean;
  tax_due_kobo: number;
  tax_without_deductions_kobo: number;
  calculated_at: string;
  is_final: boolean;
  tax_rule_sets?: { name: string } | null;
};

function toCalculation(row: CalcRow | CalcRow[] | null | undefined): TaxCalculation | null {
  const c = Array.isArray(row) ? row[0] : row;
  if (!c) {
    return null;
  }
  return {
    rulesVersion: c.rules_version,
    rulesName: c.tax_rule_sets?.name ?? null,
    taxYear: c.tax_year,
    grossIncomeKobo: Number(c.gross_income_kobo),
    businessExpensesKobo: Number(c.business_expenses_kobo),
    incomeAfterExpensesKobo: Number(c.income_after_expenses_kobo),
    reliefs: (c.reliefs ?? []).map((r) => ({
      code: r.code,
      claimedKobo: r.claimed_kobo === null ? null : Number(r.claimed_kobo),
      appliedKobo: Number(r.applied_kobo),
      status: r.status,
      note: r.note ?? null,
    })),
    totalReliefsKobo: Number(c.total_reliefs_kobo),
    taxableIncomeKobo: Number(c.taxable_income_kobo),
    bands: (c.bands ?? []).map((b) => ({
      fromKobo: Number(b.from_kobo),
      widthKobo: b.width_kobo === null ? null : Number(b.width_kobo),
      rateBp: Number(b.rate_bp),
      taxableKobo: Number(b.taxable_kobo),
      taxKobo: Number(b.tax_kobo),
    })),
    bandTaxKobo: Number(c.band_tax_kobo),
    minimumTaxKobo: c.minimum_tax_kobo === null ? null : Number(c.minimum_tax_kobo),
    minimumTaxApplied: c.minimum_tax_applied,
    taxDueKobo: Number(c.tax_due_kobo),
    taxWithoutDeductionsKobo: Number(c.tax_without_deductions_kobo),
    calculatedAt: c.calculated_at,
    isFinal: c.is_final,
  };
}

type FilingRow = {
  id: string;
  tax_year: number;
  status: FilingStatus;
  current_step: FilingStep;
  reference: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  business_expenses_kobo: number;
  income_confirmed_at: string | null;
  filing_income_sources: {
    platform: string;
    amount_kobo: number | null;
    amount_source: AmountSource | null;
    ai_suggested_kobo: number | null;
    position: number;
  }[];
  filing_deductions: { deduction_type: string; amount_paid_kobo: number | null }[];
  filing_documents: { slot: string; document_id: string | null }[];
  filing_tax_calculations: CalcRow | CalcRow[] | null;
};

const FILING_SELECT =
  'id, tax_year, status, current_step, reference, created_at, updated_at, submitted_at, ' +
  'business_expenses_kobo, income_confirmed_at, ' +
  'filing_income_sources(platform, amount_kobo, amount_source, ai_suggested_kobo, position), ' +
  'filing_deductions(deduction_type, amount_paid_kobo), ' +
  'filing_documents(slot, document_id), ' +
  'filing_tax_calculations(*, tax_rule_sets(name))';

function toFiling(row: FilingRow): Filing {
  const sources = [...(row.filing_income_sources ?? [])].sort((a, b) => a.position - b.position);
  const incomeSources: IncomeSource[] = sources.map((s) => ({
    id: `income-${s.platform}`,
    label: s.platform,
    amountKobo: s.amount_kobo === null ? null : Number(s.amount_kobo),
    amountSource: s.amount_source,
    aiSuggestedKobo: s.ai_suggested_kobo === null ? null : Number(s.ai_suggested_kobo),
  }));
  const deductions: Deduction[] = (row.filing_deductions ?? []).map((d) => ({
    id: d.deduction_type,
    label: DEDUCTION_DEFINITIONS.find((def) => def.id === d.deduction_type)?.label ?? d.deduction_type,
    amountPaidKobo: d.amount_paid_kobo === null ? null : Number(d.amount_paid_kobo),
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
    businessExpensesKobo: Number(row.business_expenses_kobo ?? 0),
    incomeConfirmedAt: row.income_confirmed_at,
    deductions,
    documentIdsByKey,
    totalIncomeKobo: incomeSources.reduce((sum, s) => sum + (s.amountKobo ?? 0), 0),
    taxCalculation: toCalculation(row.filing_tax_calculations),
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
  /** By platform. Platforms without an entry are saved with no amount. */
  income?: Record<string, { amountKobo: number | null; amountSource: AmountSource | null }>;
  businessExpensesKobo?: number;
  /** The user has just confirmed their income figures. */
  incomeConfirmed?: boolean;
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
          const entry = update.income?.[platform];
          return {
            platform,
            amount_kobo: entry?.amountKobo ?? null,
            amount_source: entry?.amountKobo === null || !entry ? null : entry.amountSource,
          };
        })
      : null,
    p_business_expenses_kobo: update.businessExpensesKobo ?? null,
    p_income_confirmed: update.incomeConfirmed ?? null,
    p_deductions: update.deductions
      ? update.deductions.map((d) => ({ deduction_type: d.id, amount_paid_kobo: d.amountPaidKobo }))
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
    case 'income_unconfirmed':
      return {
        id: 'income_unconfirmed',
        label: 'Income amounts not confirmed',
        step: 'income_summary',
      };
    case 'deduction_amount': {
      const definition = DEDUCTION_DEFINITIONS.find((d) => d.id === item.deduction_type);
      return {
        id: `deduction_amount:${item.deduction_type}`,
        label: `Amount missing for ${definition?.label ?? 'a deduction'}`,
        step: 'deductions',
        focus: item.deduction_type,
      };
    }
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

export type ReliefRule = { allowed: boolean; reason?: string; note?: string };

/** Which deductions a tax year allows (the server's rules table), e.g. rent
 * relief only from 2026. Null if it couldn't be loaded. */
export async function getTaxRules(
  taxYear: number
): Promise<{ version: string; name: string; reliefs: Record<string, ReliefRule> } | null> {
  const { data, error } = await supabase
    .from('tax_rule_sets')
    .select('version, name, params, tax_year_from, tax_year_to')
    .lte('tax_year_from', taxYear)
    .order('tax_year_from', { ascending: false });
  if (error || !data) {
    return null;
  }
  const rules = (data as { version: string; name: string; params: { reliefs?: Record<string, ReliefRule> }; tax_year_to: number | null }[])
    .find((r) => r.tax_year_to === null || r.tax_year_to >= taxYear);
  return rules ? { version: rules.version, name: rules.name, reliefs: rules.params.reliefs ?? {} } : null;
}

/** Deductions the tax rules actually applied (excluding the automatic
 * consolidated relief), or — with no calculation — what was claimed. */
export function deductionsTotalKobo(filing: Filing): number {
  if (filing.taxCalculation) {
    return filing.taxCalculation.reliefs
      .filter((r) => r.code !== 'cra')
      .reduce((sum, r) => sum + r.appliedKobo, 0);
  }
  return filing.deductions.reduce((sum, d) => sum + (d.amountPaidKobo ?? 0), 0);
}

/** How a status reads to the user. */
export const STATUS_LABELS: Record<FilingStatus, string> = {
  draft: 'In progress',
  submitted: 'Submitted',
  processing: 'Processing',
  completed: 'Filed',
  rejected: 'Rejected',
};
