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
  /** Label for the amount field: what the user actually paid in the tax
   * year. The server's tax rules decide how much of it is allowed. */
  amountLabel: string;
};

export const DEDUCTION_DEFINITIONS: DeductionDefinition[] = [
  {
    id: 'rent',
    label: 'Rent payments',
    description:
      'If you rented your home in {taxYear}, 20% of the rent you paid can be deducted from your taxable income, up to ₦500,000.',
    documentLabel: 'rent receipt',
    documentCategory: 'receipt',
    amountLabel: 'Rent you paid in {taxYear} (₦)',
  },
  {
    id: 'life_assurance',
    label: 'Life assurance premium',
    description:
      'Full premium paid on a life insurance policy. Document needed — insurance premium receipt from a registered insurer.',
    documentLabel: 'insurance premium receipt',
    documentCategory: 'receipt',
    amountLabel: 'Premiums you paid in {taxYear} (₦)',
  },
  {
    id: 'pension',
    label: 'Pension contributions',
    description:
      'Contributions you made to a registered pension fund (PFA or micro-pension) under the Pension Reform Act. Document needed — annual PFA statement.',
    documentLabel: 'PFA statement',
    documentCategory: 'other',
    amountLabel: 'Pension contributions you made in {taxYear} (₦)',
  },
  {
    id: 'nhf',
    label: 'National Housing Fund (NHF)',
    description:
      'Contributions you made to the National Housing Fund (Federal Mortgage Bank). Document needed — NHF contribution statement.',
    documentLabel: 'NHF contribution statement',
    documentCategory: 'other',
    amountLabel: 'NHF contributions you made in {taxYear} (₦)',
  },
];

/** A deduction's description with the filing's tax year filled in. */
export const deductionDescription = (definition: DeductionDefinition, taxYear: number) =>
  definition.description.replace('{taxYear}', String(taxYear));

/** A deduction's amount-field label with the filing's tax year filled in. */
export const deductionAmountLabel = (definition: DeductionDefinition, taxYear: number) =>
  definition.amountLabel.replace('{taxYear}', String(taxYear));

/** The deduction types the database accepts (filing_deductions.deduction_type). */
export type DeductionType = 'rent' | 'life_assurance' | 'pension' | 'nhf';

/** Namespaced so this doesn't collide with platform names in the same `uploadedDocuments` array. */
export const deductionDocumentKey = (deductionId: string) => `deduction:${deductionId}`;
