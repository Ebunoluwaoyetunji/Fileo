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

type FilingState = {
  selectedPlatforms: string[];
  uploadedDocuments: string[];
  incomeSources: IncomeSource[];
  deductions: Deduction[];
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
  resetFiling: () => void;
};

const initialState: FilingState = {
  selectedPlatforms: [],
  uploadedDocuments: [],
  incomeSources: [],
  deductions: [],
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

  const resetFiling = () => setState(initialState);

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
