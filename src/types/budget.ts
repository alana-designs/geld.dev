export type ParentCategory = 'Needs' | 'Wants' | 'Savings';

export interface Member {
  id: string;
  name: string;
  email: string;
  /** The signed-in person. Only their data is editable. */
  isSelf: boolean;
  status: 'active' | 'pending';
  /** Accent used for member chips and the household breakdown. */
  color: string;
  demo?: boolean;
}

export interface Category {
  id: string;
  memberId: string;
  name: string;
  parent: ParentCategory;
  monthlyGoal: number;
  archived: boolean;
}

export interface Transaction {
  id: string;
  memberId: string;
  amount: number;
  categoryId: string;
  description: string;
  /** ISO date string: yyyy-MM-dd */
  date: string;
  createdAt: string;
  /** True on a real, manually-logged entry that projects forward monthly on this date. */
  recurring?: boolean;
  /** Generated, not typed in by hand — read-only, edit the source instead. */
  auto?: boolean;
  /** What generated this `auto` entry. Payroll entries stay out of spend
   *  reconciliation (that money was never spendable cash); recurring-expense
   *  entries are real projected spending and count normally. */
  autoSource?: 'income' | 'recurring';
  /** The paycheck deduction behind an `autoSource: 'income'` entry. Set only
   *  on real rows, so it's what tells a payroll entry (deletable, one pay date
   *  at a time) apart from a recurring projection (no row to delete). */
  incomeDeductionId?: string;
  /** This payroll entry was corrected by hand, so it no longer matches what
   *  the deduction would generate. Carrying a later change forward skips it. */
  overridden?: boolean;
}

export interface AuthUser {
  email: string;
}

export const PARENT_CATEGORIES: ParentCategory[] = ['Needs', 'Wants', 'Savings'];

export const PARENT_STYLES: Record<
  ParentCategory,
  {hex: string;text: string;bg: string;border: string;dot: string;blurb: string;}> =
{
  Needs: {
    hex: '#2f4832',
    text: 'text-needs',
    bg: 'bg-needs/8',
    border: 'border-needs/25',
    dot: 'bg-needs',
    blurb: 'Rent, food, transport — the non-negotiables.'
  },
  Wants: {
    hex: '#c4764c',
    text: 'text-wants',
    bg: 'bg-wants/8',
    border: 'border-wants/25',
    dot: 'bg-wants',
    blurb: 'The fun stuff you choose to spend on.'
  },
  Savings: {
    hex: '#3f7a78',
    text: 'text-savings',
    bg: 'bg-savings/8',
    border: 'border-savings/25',
    dot: 'bg-savings',
    blurb: 'Money you move forward, not out.'
  }
};
/** Category chart colors, assigned by rank. The last one is for "everything else". */
export const CHART_COLORS = ['#2f4832', '#3f7a78', '#c4764c', '#d4b170', '#8a5f7e', '#8fbfa3'];
