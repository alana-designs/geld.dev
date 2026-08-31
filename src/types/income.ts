export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

/** Salaried has a fixed pay frequency; hourly paychecks vary and get
 *  entered manually as they come, with no assumed schedule. */
export type PayType = 'salaried' | 'hourly';

/** Which two calendar dates a semimonthly paycheck lands on. Only meaningful
 *  when frequency === 'semimonthly'. */
export type SemimonthlySchedule = '1st_15th' | '15th_last';

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
  payType: PayType;
  grossPay: number;
  /** Required for salaried; null for hourly (no fixed schedule). */
  frequency: PayFrequency | null;
  /** Which two dates a semimonthly paycheck lands on. Null unless
   *  frequency === 'semimonthly'. */
  semimonthlySchedule: SemimonthlySchedule | null;
  /** ISO date (yyyy-MM-dd) this paycheck was received — required for
   *  hourly, null for salaried. Determines which month it counts toward. */
  paycheckDate: string | null;
  preTax: Deduction[];
  taxes: TaxLine[];
  postTax: Deduction[];
  /** Set when the user overrides the calculated net. */
  netOverride: number | null;
  updatedAt: string;
}