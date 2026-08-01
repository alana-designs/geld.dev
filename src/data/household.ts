import { format, subDays } from 'date-fns';
import { Category, Member, Transaction } from '../types/budget';
import { IncomeSource } from '../types/income';

export const SELF_ID = 'me';
export const HOUSEHOLD_VIEW = 'household';

export const seedMembers: Member[] = [
{
  id: SELF_ID,
  name: 'You',
  email: 'you@example.com',
  isSelf: true,
  status: 'active',
  color: '#38352f'
},
{
  id: 'alex',
  name: 'Alex',
  email: 'alex@example.com',
  isSelf: false,
  status: 'active',
  color: '#b8873f',
  demo: true
}];


const partner = (rows: Omit<Category, 'memberId'>[]): Category[] =>
rows.map((row) => ({ ...row, memberId: 'alex' }));

export const partnerCategories: Category[] = partner([
{ id: 'a-rent', name: 'Rent', parent: 'Needs', monthlyGoal: 1850, archived: false },
{ id: 'a-groceries', name: 'Groceries', parent: 'Needs', monthlyGoal: 380, archived: false },
{ id: 'a-gas', name: 'Gas / Transit', parent: 'Needs', monthlyGoal: 180, archived: false },
{ id: 'a-utilities', name: 'Utilities', parent: 'Needs', monthlyGoal: 90, archived: false },
{ id: 'a-eating-out', name: 'Eating Out', parent: 'Wants', monthlyGoal: 260, archived: false },
{ id: 'a-shopping', name: 'Shopping', parent: 'Wants', monthlyGoal: 120, archived: false },
{ id: 'a-climbing', name: 'Climbing', parent: 'Wants', monthlyGoal: 90, archived: false },
{ id: 'a-retirement', name: 'Retirement', parent: 'Savings', monthlyGoal: 500, archived: false },
{ id: 'a-emergency', name: 'Emergency Fund', parent: 'Savings', monthlyGoal: 300, archived: false }]
);

const day = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd');

const partnerSeeds = [
{ daysAgo: 0, amount: 12.4, categoryId: 'a-eating-out', description: 'Breakfast burrito' },
{ daysAgo: 1, amount: 64.18, categoryId: 'a-groceries', description: 'Groceries — Sunday shop' },
{ daysAgo: 2, amount: 925, categoryId: 'a-rent', description: 'July rent — my half' },
{ daysAgo: 3, amount: 52.3, categoryId: 'a-gas', description: 'Gas, drive to Ojai' },
{ daysAgo: 4, amount: 300, categoryId: 'a-emergency', description: 'Monthly transfer' },
{ daysAgo: 5, amount: 88, categoryId: 'a-shopping', description: 'New climbing shoes' },
{ daysAgo: 6, amount: 31.75, categoryId: 'a-eating-out', description: 'Ramen after the gym' },
{ daysAgo: 8, amount: 45, categoryId: 'a-utilities', description: 'Internet — my share' },
{ daysAgo: 11, amount: 90, categoryId: 'a-climbing', description: 'Gym membership' },
{ daysAgo: 14, amount: 58.6, categoryId: 'a-groceries', description: 'Costco, split with you' }];


export const partnerTransactions: Transaction[] = partnerSeeds.map((s, i) => ({
  id: `alex-${i}`,
  memberId: 'alex',
  amount: s.amount,
  categoryId: s.categoryId,
  description: s.description,
  date: day(s.daysAgo),
  createdAt: new Date(Date.now() - s.daysAgo * 86400000).toISOString()
}));

export const partnerIncome: IncomeSource[] = [
{
  id: 'alex-income',
  memberId: 'alex',
  name: 'Studio paycheck',
  grossPay: 3400,
  frequency: 'biweekly',
  preTax: [
  { id: 'a-401k', label: '401(k) contribution', amount: 240, tag: 'retirement', categoryId: 'a-retirement' },
  { id: 'a-health', label: 'Health premium', amount: 120, tag: 'other' }],

  taxes: [
  { id: 'a-fed', label: 'Federal income tax', amount: 415 },
  { id: 'a-state', label: 'State income tax', amount: 142 },
  { id: 'a-fica', label: 'FICA', amount: 198 }],

  postTax: [],
  netOverride: null,
  origin: 'manual',
  updatedAt: new Date().toISOString()
}];