export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/**
 * What matters is whether the money ever became spendable cash —
 * not Roth vs. traditional.
 */
export type DeductionTag = 'retirement' | 'other';

export interface Deduction {
  id: string;
  label: string;
  amount: number;
  tag: DeductionTag;
  /** Savings subcategory the auto entry lands in (retirement-tagged only). */
  categoryId?: string;
}

export interface TaxLine {
  id: string;
  label: string;
  amount: number;
}

/** Editable form shapes — amounts stay strings while being typed. */
export interface DeductionDraft {
  id: string;
  label: string;
  amount: string;
  tag: DeductionTag;
  categoryId?: string;
}

export interface TaxDraft {
  id: string;
  label: string;
  amount: string;
}

export interface IncomeSource {
  id: string;
  memberId: string;
  name: string;
  grossPay: number;
  frequency: PayFrequency;
  preTax: Deduction[];
  taxes: TaxLine[];
  postTax: Deduction[];
  /** Set when the user overrides the calculated net. */
  netOverride: number | null;
  updatedAt: string;
}