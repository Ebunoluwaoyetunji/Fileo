/**
 * Shared filing-flow state: selected platforms, uploaded documents, income
 * and deductions data. Scoped to the (app) route group so it lives for the
 * duration of a filing session and resets when the flow completes.
 */
import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

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
 * One completed filing. There's only ever one filing flow in the app today
 * (no multi-year support yet), so this is created once, when the user
 * reaches Confirmation — a snapshot of that filing's income/deductions
 * rather than a live reference, so it stays accurate after `resetFiling`
 * clears the in-progress fields for a next filing.
 */
export type FilingHistoryEntry = {
  id: string;
  submittedAt: string; // ISO timestamp, real (not mocked) — the moment Confirmation was reached.
  status: 'Submitted'; // the only status this prototype produces — see confirmation.tsx.
  taxYear: string;
  totalIncome: number;
  totalDeductions: number;
  incomeSources: IncomeSource[];
  deductions: Deduction[];
};

type FilingState = {
  selectedPlatforms: string[];
  uploadedDocuments: string[];
  incomeSources: IncomeSource[];
  deductions: Deduction[];
  filingHistory: FilingHistoryEntry[];
};

type FilingContextValue = FilingState & {
  setSelectedPlatforms: (platforms: string[]) => void;
  togglePlatform: (platform: string) => void;
  addUploadedDocument: (documentUri: string) => void;
  removeUploadedDocument: (documentUri: string) => void;
  setIncomeSources: (sources: IncomeSource[]) => void;
  setDeductions: (deductions: Deduction[]) => void;
  totalIncome: number;
  totalDeductions: number;
  /** Snapshots the current income/deductions into filingHistory. Called once, from confirmation.tsx. */
  recordSubmission: () => void;
  resetFiling: () => void;
};

const initialState: FilingState = {
  selectedPlatforms: [],
  uploadedDocuments: [],
  incomeSources: [],
  deductions: [],
  filingHistory: [],
};

const FilingContext = createContext<FilingContextValue | undefined>(undefined);

export function FilingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilingState>(initialState);

  const setSelectedPlatforms = (platforms: string[]) =>
    setState((prev) => ({ ...prev, selectedPlatforms: platforms }));

  const togglePlatform = (platform: string) =>
    setState((prev) => ({
      ...prev,
      selectedPlatforms: prev.selectedPlatforms.includes(platform)
        ? prev.selectedPlatforms.filter((item) => item !== platform)
        : [...prev.selectedPlatforms, platform],
    }));

  const addUploadedDocument = (documentUri: string) =>
    setState((prev) => ({
      ...prev,
      uploadedDocuments: [...prev.uploadedDocuments, documentUri],
    }));

  const removeUploadedDocument = (documentUri: string) =>
    setState((prev) => ({
      ...prev,
      uploadedDocuments: prev.uploadedDocuments.filter((uri) => uri !== documentUri),
    }));

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
        taxYear: '2025', // matches the static "Tax year" shown on Return Review.
        totalIncome: prev.incomeSources.reduce((sum, item) => sum + item.amount, 0),
        totalDeductions: prev.deductions.reduce((sum, item) => sum + item.amount, 0),
        incomeSources: prev.incomeSources,
        deductions: prev.deductions,
      };
      return { ...prev, filingHistory: [entry, ...prev.filingHistory] };
    });

  // Clears the in-progress filing fields for a next filing, but keeps
  // filingHistory — it's called right before returning Home from
  // Confirmation, and a just-recorded entry shouldn't disappear with it.
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
