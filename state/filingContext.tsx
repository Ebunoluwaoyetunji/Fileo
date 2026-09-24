/**
 * Filing state, backed by Supabase (lib/filings.ts):
 *
 *  - `draft`: the user's return in progress (one per tax year), as last saved.
 *  - `filingHistory`: their submitted returns, newest first.
 *  - A working copy of the draft (selected platforms, uploaded documents,
 *    income, deductions) that the flow screens edit. Each step saves it with
 *    `saveProgress(nextStep)` when the user taps Continue — nothing is saved
 *    on every keystroke — and `startFiling()` resets it from the saved draft,
 *    so resuming (after a restart, reinstall or on another phone) picks up
 *    exactly what was last saved.
 *  - Uploaded documents are linked to their slot as soon as they're uploaded
 *    (and again on Continue, in case that first link didn't get through).
 *
 * Scoped to the (app) route group, which only renders while signed in, so
 * signing out (or in as someone else) starts from a fresh load.
 */
import type { Href } from 'expo-router';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  currentTaxYear,
  Deduction,
  Filing,
  FilingError,
  FilingStep,
  getOrCreateDraft,
  IncomeSource,
  linkFilingDocument,
  listFilings,
  saveFilingProgress,
  STEP_ROUTES,
  submitFiling,
} from '../lib/filings';

export type { Deduction, Filing, IncomeSource } from '../lib/filings';

/** Flat, clearly-mock rate — NOT how Nigerian PIT actually works (it's
 * progressive/bracketed in reality). Display-only estimate on Return Review
 * and Home until tax calculation moves to the server; never stored. */
export const MOCK_TAX_RATE = 0.15;

/** A submitted return (anything past draft). */
export type FilingHistoryEntry = Filing & { reference: string; submittedAt: string };

type WorkingCopy = {
  selectedPlatforms: string[];
  documentIdsByKey: Record<string, string>;
  incomeSources: IncomeSource[];
  deductions: Deduction[];
};

const EMPTY_WORKING_COPY: WorkingCopy = {
  selectedPlatforms: [],
  documentIdsByKey: {},
  incomeSources: [],
  deductions: [],
};

function workingCopyFrom(filing: Filing | null): WorkingCopy {
  if (!filing) {
    return EMPTY_WORKING_COPY;
  }
  return {
    selectedPlatforms: filing.platforms,
    documentIdsByKey: filing.documentIdsByKey,
    incomeSources: filing.incomeSources,
    deductions: filing.deductions,
  };
}

type FilingContextValue = WorkingCopy & {
  /** True until the first load finishes. */
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  draft: Filing | null;
  filingHistory: FilingHistoryEntry[];
  /** The draft's tax year, or the year a new filing would be for. */
  taxYear: number;
  /** A return for the current tax year has already been submitted. */
  hasFiledCurrentYear: boolean;

  /** Slot keys (platform names, deductionDocumentKey(type)) that have a document. */
  uploadedDocuments: string[];
  setSelectedPlatforms: (platforms: string[]) => void;
  togglePlatform: (platform: string) => void;
  /** Puts a just-uploaded document in a slot (and links it on the server). */
  addUploadedDocument: (key: string, documentId: string) => Promise<{ error: FilingError | null }>;
  /** Empties any slot holding this document (after it's been deleted). */
  forgetDocument: (documentId: string) => void;
  setIncomeSources: (sources: IncomeSource[]) => void;
  setDeductions: (deductions: Deduction[]) => void;
  totalIncome: number;
  totalDeductions: number;

  /** Resumes the draft (or creates one for the current tax year) and says
   * where to go: its saved step, or the File tab if this year is filed. */
  startFiling: () => Promise<{ route: Href; error: null } | { route: null; error: FilingError }>;
  /** Saves the working copy and the step to resume at. */
  saveProgress: (nextStep: FilingStep) => Promise<{ error: FilingError | null }>;
  /** Submits the draft; the server checks it and returns the reference. */
  submit: () => Promise<
    { reference: string; submittedAt: string; error: null } | { reference: null; submittedAt: null; error: FilingError }
  >;
};

const FilingContext = createContext<FilingContextValue | undefined>(undefined);

export function FilingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Filing | null>(null);
  const [filingHistory, setFilingHistory] = useState<FilingHistoryEntry[]>([]);
  const [working, setWorking] = useState<WorkingCopy>(EMPTY_WORKING_COPY);
  const draftRef = useRef<Filing | null>(null);
  draftRef.current = draft;

  const reload = useCallback(async () => {
    const result = await listFilings();
    setIsLoading(false);
    if (result.error) {
      setLoadError(result.error.code === 'network'
        ? 'Couldn’t load your filings. Check your connection and try again.'
        : 'Couldn’t load your filings. Please try again.');
      return;
    }
    setLoadError(null);
    const drafts = result.filings
      .filter((f) => f.status === 'draft')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const history = result.filings
      .filter((f): f is FilingHistoryEntry => f.status !== 'draft' && !!f.reference && !!f.submittedAt)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const nextDraft = drafts[0] ?? null;
    setDraft(nextDraft);
    setFilingHistory(history);
    // First load: start the working copy from what's saved.
    if (draftRef.current === null && nextDraft) {
      setWorking(workingCopyFrom(nextDraft));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const taxYear = draft?.taxYear ?? currentTaxYear();
  const hasFiledCurrentYear = filingHistory.some((f) => f.taxYear === currentTaxYear());

  const startFiling = useCallback<FilingContextValue['startFiling']>(async () => {
    if (!draft && filingHistory.some((f) => f.taxYear === currentTaxYear())) {
      return { route: '/(app)/filing-history', error: null };
    }
    const result = await getOrCreateDraft(draft?.taxYear ?? currentTaxYear());
    if (result.error) {
      if (result.error.code === 'already_filed') {
        await reload();
        return { route: '/(app)/filing-history', error: null };
      }
      return { route: null, error: result.error };
    }
    setDraft(result.filing);
    setWorking(workingCopyFrom(result.filing));
    return { route: STEP_ROUTES[result.filing.currentStep], error: null };
  }, [draft, filingHistory, reload]);

  const saveProgress = useCallback<FilingContextValue['saveProgress']>(
    async (nextStep) => {
      if (!draft) {
        return { error: { code: 'not_draft', message: 'There’s no return in progress.' } };
      }
      const incomeByPlatform: Record<string, number> = {};
      working.incomeSources.forEach((s) => {
        incomeByPlatform[s.label] = s.amount;
      });
      const { error } = await saveFilingProgress(draft.id, nextStep, {
        platforms: working.selectedPlatforms,
        incomeByPlatform,
        deductions: working.deductions,
        documents: working.documentIdsByKey,
      });
      if (error) {
        if (error.code === 'not_draft') {
          await reload();
        }
        return { error };
      }
      const confirmed = working.incomeSources.filter((s) =>
        working.selectedPlatforms.includes(s.label)
      );
      setDraft({
        ...draft,
        currentStep: nextStep,
        platforms: working.selectedPlatforms,
        incomeSources: confirmed,
        deductions: working.deductions,
        documentIdsByKey: { ...draft.documentIdsByKey, ...working.documentIdsByKey },
        totalIncome: confirmed.reduce((sum, s) => sum + s.amount, 0),
        totalDeductions: working.deductions.reduce((sum, d) => sum + d.amount, 0),
        updatedAt: new Date().toISOString(),
      });
      return { error: null };
    },
    [draft, working, reload]
  );

  const addUploadedDocument = useCallback<FilingContextValue['addUploadedDocument']>(
    async (key, documentId) => {
      setWorking((prev) => ({
        ...prev,
        documentIdsByKey: { ...prev.documentIdsByKey, [key]: documentId },
      }));
      if (!draft) {
        return { error: null };
      }
      const { error } = await linkFilingDocument(draft.id, draft.currentStep, key, documentId);
      if (!error) {
        setDraft((prev) =>
          prev ? { ...prev, documentIdsByKey: { ...prev.documentIdsByKey, [key]: documentId } } : prev
        );
      }
      return { error };
    },
    [draft]
  );

  const forgetDocument = useCallback((documentId: string) => {
    const without = (map: Record<string, string>) =>
      Object.fromEntries(Object.entries(map).filter(([, id]) => id !== documentId));
    setWorking((prev) => ({ ...prev, documentIdsByKey: without(prev.documentIdsByKey) }));
    setDraft((prev) => (prev ? { ...prev, documentIdsByKey: without(prev.documentIdsByKey) } : prev));
  }, []);

  const submit = useCallback<FilingContextValue['submit']>(async () => {
    if (!draft) {
      return { reference: null, submittedAt: null, error: { code: 'not_draft', message: 'There’s no return in progress.' } };
    }
    const result = await submitFiling(draft.id);
    if (result.error) {
      if (result.error.code === 'not_draft') {
        await reload();
      }
      return result;
    }
    setWorking(EMPTY_WORKING_COPY);
    await reload();
    return result;
  }, [draft, reload]);

  const value = useMemo<FilingContextValue>(() => {
    const totalIncome = working.incomeSources.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = working.deductions.reduce((sum, item) => sum + item.amount, 0);
    return {
      ...working,
      isLoading,
      loadError,
      reload,
      draft,
      filingHistory,
      taxYear,
      hasFiledCurrentYear,
      uploadedDocuments: Object.keys(working.documentIdsByKey),
      setSelectedPlatforms: (selectedPlatforms) => setWorking((prev) => ({ ...prev, selectedPlatforms })),
      togglePlatform: (platform) =>
        setWorking((prev) => ({
          ...prev,
          selectedPlatforms: prev.selectedPlatforms.includes(platform)
            ? prev.selectedPlatforms.filter((item) => item !== platform)
            : [...prev.selectedPlatforms, platform],
        })),
      addUploadedDocument,
      forgetDocument,
      setIncomeSources: (incomeSources) => setWorking((prev) => ({ ...prev, incomeSources })),
      setDeductions: (deductions) => setWorking((prev) => ({ ...prev, deductions })),
      totalIncome,
      totalDeductions,
      startFiling,
      saveProgress,
      submit,
    };
  }, [
    working,
    isLoading,
    loadError,
    reload,
    draft,
    filingHistory,
    taxYear,
    hasFiledCurrentYear,
    addUploadedDocument,
    forgetDocument,
    startFiling,
    saveProgress,
    submit,
  ]);

  return <FilingContext.Provider value={value}>{children}</FilingContext.Provider>;
}

export function useFiling() {
  const context = useContext(FilingContext);
  if (!context) {
    throw new Error('useFiling must be used within a FilingProvider');
  }
  return context;
}
