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
  /** Generated from a tagged paystub deduction, not typed in by hand. */
  auto?: boolean;
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
    hex: '#6f7a4a',
    text: 'text-needs',
    bg: 'bg-needs/8',
    border: 'border-needs/25',
    dot: 'bg-needs',
    blurb: 'Rent, food, transport — the non-negotiables.'
  },
  Wants: {
    hex: '#c1743c',
    text: 'text-wants',
    bg: 'bg-wants/8',
    border: 'border-wants/25',
    dot: 'bg-wants',
    blurb: 'The fun stuff you choose to spend on.'
  },
  Savings: {
    hex: '#93627e',
    text: 'text-savings',
    bg: 'bg-savings/8',
    border: 'border-savings/25',
    dot: 'bg-savings',
    blurb: 'Money you move forward, not out.'
  }
};