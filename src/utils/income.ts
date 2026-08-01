import { Category, Transaction } from '../types/budget';
import { Deduction, IncomeSource, PayFrequency } from '../types/income';
import { toMonthKey } from './rollups';

export const FREQUENCIES: {
  value: PayFrequency;
  label: string;
  short: string;
  perMonth: number;
}[] = [
{ value: 'weekly', label: 'Weekly', short: 'per week', perMonth: 52 / 12 },
{ value: 'biweekly', label: 'Every 2 weeks', short: 'every 2 weeks', perMonth: 26 / 12 },
{ value: 'semimonthly', label: 'Twice a month', short: 'twice a month', perMonth: 2 },
{ value: 'monthly', label: 'Monthly', short: 'per month', perMonth: 1 }];


export function frequencyMeta(frequency: PayFrequency) {
  return FREQUENCIES.find((f) => f.value === frequency) ?? FREQUENCIES[1];
}

export function sumAmounts(rows: {amount: number;}[]) {
  return rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
}

export function computedNet(source: IncomeSource) {
  return (
    source.grossPay - sumAmounts(source.preTax) - sumAmounts(source.taxes) - sumAmounts(source.postTax));

}

export function netPerPeriod(source: IncomeSource) {
  return source.netOverride ?? computedNet(source);
}

export function monthlyNet(source: IncomeSource) {
  return netPerPeriod(source) * frequencyMeta(source.frequency).perMonth;
}

export function totalMonthlyNet(sources: IncomeSource[]) {
  return sources.reduce((sum, source) => sum + monthlyNet(source), 0);
}

export function retirementDeductions(source: IncomeSource): Deduction[] {
  return [...source.preTax, ...source.postTax].filter((d) => d.tag === 'retirement');
}

/** Approximate pay dates inside a month, never in the future. */
export function payDatesInMonth(frequency: PayFrequency, key: string, today = new Date()) {
  const [year, month] = key.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const byFrequency: Record<PayFrequency, number[]> = {
    weekly: [7, 14, 21, 28],
    biweekly: [14, 28],
    semimonthly: [15, lastDay],
    monthly: [lastDay]
  };
  const cutoff = toMonthKey(today) === key ? today.getDate() : lastDay;
  return byFrequency[frequency].
  filter((day) => day <= cutoff).
  map((day) => `${key}-${String(day).padStart(2, '0')}`);
}

/**
 * Payroll retirement deductions become Savings entries marked "Auto · from
 * paycheck". They are real entries, but never part of the take-home
 * reconciliation math — that money was never spendable cash.
 */
export function generateAutoEntries(
sources: IncomeSource[],
categories: Category[],
key: string,
today = new Date())
: Transaction[] {
  const savings = categories.filter((c) => c.parent === 'Savings');
  const fallback = savings.find((c) => !c.archived)?.id ?? savings[0]?.id;
  if (!fallback) return [];

  const entries: Transaction[] = [];
  sources.forEach((source) => {
    const deductions = retirementDeductions(source);
    if (deductions.length === 0) return;
    payDatesInMonth(source.frequency, key, today).forEach((date) => {
      deductions.forEach((deduction) => {
        if (deduction.amount <= 0) return;
        const categoryId = savings.some((c) => c.id === deduction.categoryId) ?
        deduction.categoryId as string :
        fallback;
        entries.push({
          id: `auto-${source.id}-${deduction.id}-${date}`,
          memberId: source.memberId,
          amount: deduction.amount,
          categoryId,
          description: `${deduction.label} — ${source.name}`,
          date,
          createdAt: `${date}T09:00:00.000Z`,
          auto: true
        });
      });
    });
  });
  return entries;
}