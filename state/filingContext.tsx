/**
 * Shared filing-flow state: selected platforms, uploaded documents, income
 * and deductions data. Scoped to the (app) route group so it lives for the
 * duration of a filing session and resets when the flow completes.
 */
import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/** The one tax year this whole mock flow produces — return-review.tsx's
 * Filing Information card and recordSubmission() below both use this. */
export const CURRENT_TAX_YEAR = '2025';

/** Flat, clearly-mock rate — NOT how Nigerian PIT actually works (it's
 * progressive/bracketed in reality). Shared by return-review.tsx (tax due /
 * savings on the current in-progress filing) and home.tsx (the "Total
 * saved" stat, summed across past filings) so both use one number. */
export const MOCK_TAX_RATE = 0.15;

export type IncomeSource = {
  id: string;
  label: string;
  amount: number;
};

export type Deduction = {
  id: string;
  label: string;
  amount: number;
};

/**
 * One completed filing. The live flow only ever produces 'Submitted'
 * entries (via recordSubmission below) — 'Filed' exists so a fully
 * processed *past* filing can be shown too (see MOCK_PRIOR_FILING), since
 * there's no real backend to advance a 'Submitted' entry to 'Filed' on its
 * own.
 */
export type FilingStatusLabel = 'Submitted' | 'Filed';

export type FilingHistoryEntry = {
  id: string;
  submittedAt: string; // ISO timestamp.
  status: FilingStatusLabel;
  taxYear: string;
  totalIncome: number;
  totalDeductions: number;
  incomeSources: IncomeSource[];
  deductions: Deduction[];
  /** Only set once a filing reaches 'Filed' — the amount actually paid. */
  amountPaid?: number;
};

/**
 * ⚠️ Illustrative only — not produced by anything in this app. There's no
 * real backend to age a 'Submitted' filing into a fully-processed 'Filed'
 * one with a paid amount and a downloadable certificate, so this one static
 * "prior year" entry stands in for what that eventually looks like. It's
 * appended after the real (dynamic) filingHistory entries, and only once
 * the user has at least one real entry — see filing-history.tsx and
 * documents.tsx.
 */
export const MOCK_PRIOR_FILING: FilingHistoryEntry = {
  id: 'mock-prior-filing',
  submittedAt: '2024-09-14T00:00:00.000Z',
  status: 'Filed',
  taxYear: '2024',
  totalIncome: 0,
  totalDeductions: 0,
  incomeSources: [],
  deductions: [],
  amountPaid: 142000,
};

/** Distinguishes "never started" from "started but not yet submitted" —
 * the Filing tab's in-progress state (filing-history.tsx) needs this on
 * top of filingHistory to know which of its 3 states to show. */
export type FilingStatus = 'not-started' | 'in-progress';

type FilingState = {
  filingStatus: FilingStatus;
  selectedPlatforms: string[];
  /** Which upload slots are covered: platform names (Upload Documents) and
   * deductionDocumentKey(id) (Deductions). */
  uploadedDocuments: string[];
  /** The stored document (public.documents id) behind each covered slot,
   * so "Change" can delete the old file once the new one is uploaded. A
   * slot covered without a real file (the mock email link) has no entry. */
  documentIdsByKey: Record<string, string>;
  incomeSources: IncomeSource[];
  deductions: Deduction[];
  filingHistory: FilingHistoryEntry[];
};

type FilingContextValue = FilingState & {
  setSelectedPlatforms: (platforms: string[]) => void;
  togglePlatform: (platform: string) => void;
  addUploadedDocument: (key: string, documentId?: string) => void;
  removeUploadedDocument: (key: string) => void;
  /** Un-covers any slot backed by this document (after it's deleted). */
  forgetDocument: (documentId: string) => void;
  setIncomeSources: (sources: IncomeSource[]) => void;
  setDeductions: (deductions: Deduction[]) => void;
  totalIncome: number;
  totalDeductions: number;
  /** Snapshots the current income/deductions into filingHistory. Called once, from confirmation.tsx. */
  recordSubmission: () => void;
  resetFiling: () => void;
};

const initialState: FilingState = {
  filingStatus: 'not-started',
  selectedPlatforms: [],
  uploadedDocuments: [],
  documentIdsByKey: {},
  incomeSources: [],
  deductions: [],
  filingHistory: [],
};

const FilingContext = createContext<FilingContextValue | undefined>(undefined);

export function FilingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilingState>(initialState);

  const setSelectedPlatforms = (platforms: string[]) =>
    setState((prev) => ({
      ...prev,
      selectedPlatforms: platforms,
      filingStatus: platforms.length > 0 ? 'in-progress' : prev.filingStatus,
    }));

  const togglePlatform = (platform: string) =>
    setState((prev) => {
      const selectedPlatforms = prev.selectedPlatforms.includes(platform)
        ? prev.selectedPlatforms.filter((item) => item !== platform)
        : [...prev.selectedPlatforms, platform];
      return {
        ...prev,
        selectedPlatforms,
        // The first platform picked is what kicks a filing from
        // "not started" into "in progress" — the Filing tab watches this.
        filingStatus: selectedPlatforms.length > 0 ? 'in-progress' : prev.filingStatus,
      };
    });

  const addUploadedDocument = (key: string, documentId?: string) =>
    setState((prev) => {
      const documentIdsByKey = { ...prev.documentIdsByKey };
      if (documentId) {
        documentIdsByKey[key] = documentId;
      } else {
        delete documentIdsByKey[key];
      }
      return {
        ...prev,
        uploadedDocuments: prev.uploadedDocuments.includes(key)
          ? prev.uploadedDocuments
          : [...prev.uploadedDocuments, key],
        documentIdsByKey,
      };
    });

  const removeUploadedDocument = (key: string) =>
    setState((prev) => {
      const documentIdsByKey = { ...prev.documentIdsByKey };
      delete documentIdsByKey[key];
      return {
        ...prev,
        uploadedDocuments: prev.uploadedDocuments.filter((item) => item !== key),
        documentIdsByKey,
      };
    });

  const forgetDocument = (documentId: string) =>
    setState((prev) => {
      const keys = Object.keys(prev.documentIdsByKey).filter(
        (key) => prev.documentIdsByKey[key] === documentId
      );
      if (keys.length === 0) {
        return prev;
      }
      const documentIdsByKey = { ...prev.documentIdsByKey };
      keys.forEach((key) => delete documentIdsByKey[key]);
      return {
        ...prev,
        uploadedDocuments: prev.uploadedDocuments.filter((item) => !keys.includes(item)),
        documentIdsByKey,
      };
    });

  const setIncomeSources = (incomeSources: IncomeSource[]) =>
    setState((prev) => ({ ...prev, incomeSources }));

  const setDeductions = (deductions: Deduction[]) =>
    setState((prev) => ({ ...prev, deductions }));

  const recordSubmission = () =>
    setState((prev) => {
      const entry: FilingHistoryEntry = {
        id: `filing-${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: 'Submitted',
        taxYear: CURRENT_TAX_YEAR, // matches the static "Tax year" shown on Return Review.
        totalIncome: prev.incomeSources.reduce((sum, item) => sum + item.amount, 0),
        totalDeductions: prev.deductions.reduce((sum, item) => sum + item.amount, 0),
        incomeSources: prev.incomeSources,
        deductions: prev.deductions,
      };
      return { ...prev, filingHistory: [entry, ...prev.filingHistory] };
    });

  // Clears the in-progress filing fields (and filingStatus) for a next
  // filing, but keeps filingHistory — it's called right before returning
  // Home from Confirmation, and a just-recorded entry shouldn't disappear
  // with it.
  const resetFiling = () =>
    setState((prev) => ({ ...initialState, filingHistory: prev.filingHistory }));

  const value = useMemo<FilingContextValue>(() => {
    const totalIncome = state.incomeSources.reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = state.deductions.reduce((sum, item) => sum + item.amount, 0);

    return {
      ...state,
      setSelectedPlatforms,
      togglePlatform,
      addUploadedDocument,
      removeUploadedDocument,
      forgetDocument,
      setIncomeSources,
      setDeductions,
      totalIncome,
      totalDeductions,
      recordSubmission,
      resetFiling,
    };
  }, [state]);

  return <FilingContext.Provider value={value}>{children}</FilingContext.Provider>;
}

export function useFiling() {
  const context = useContext(FilingContext);
  if (!context) {
    throw new Error('useFiling must be used within a FilingProvider');
  }
  return context;
}
