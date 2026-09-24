/**
 * Static catalog for the Deductions screen's 4 toggleable categories —
 * moved here (from being local to app/(app)/deductions.tsx) once the
 * Filing tab's in-progress state also needed to know each category's
 * required-document label, to list what's still missing without
 * duplicating this data in two places.
 */
import type { DocumentCategory } from '../lib/documents';

export type DeductionDefinition = {
  id: string;
  label: string;
  description: string;
  /** What "Upload your ___" should say for this category's required document. */
  documentLabel: string;
  /** How the uploaded document is filed in the user's Documents. */
  documentCategory: DocumentCategory;
  computeAmount: (totalIncome: number) => number;
};

export const DEDUCTION_DEFINITIONS: DeductionDefinition[] = [
  {
    id: 'rent',
    label: 'Rent payments',
    description:
      'If you paid rent in 2025, you can deduct up to ₦500,000 from your taxable income. Potential saving is up to ₦75,000 off your tax bill.',
    documentLabel: 'rent receipt',
    documentCategory: 'receipt',
    computeAmount: () => 500000,
  },
  {
    id: 'life-assurance',
    label: 'Life assurance premium',
    description:
      'Full premium paid on a life insurance policy. Document needed — insurance premium receipt from a registered insurer.',
    documentLabel: 'insurance premium receipt',
    documentCategory: 'receipt',
    computeAmount: () => 0,
  },
  {
    id: 'pension',
    label: 'Pension contributions',
    description:
      'If you contributed up to 8% of your monthly gross income to a registered PFA. Document needed — annual PFA statement.',
    documentLabel: 'PFA statement',
    documentCategory: 'other',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.08),
  },
  {
    id: 'nhf',
    label: 'National Housing Fund (NHF)',
    description:
      '2.5% of monthly basic salary contributed to Federal Mortgage Bank. Document needed — NHF contribution statement.',
    documentLabel: 'NHF contribution statement',
    documentCategory: 'other',
    computeAmount: (totalIncome) => Math.round(totalIncome * 0.025),
  },
];

/** Namespaced so this doesn't collide with platform names in the same `uploadedDocuments` array. */
export const deductionDocumentKey = (deductionId: string) => `deduction:${deductionId}`;
