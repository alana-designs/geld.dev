import { format, parseISO } from 'date-fns';
import { Category, ParentCategory, Transaction } from '../types/budget';

/** yyyy-MM key for a date or ISO date string. */
export function toMonthKey(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 7) : format(value, 'yyyy-MM');
}

export function monthLabel(key: string): string {
  return format(parseISO(`${key}-01`), 'MMMM yyyy');
}

export function shortMonthLabel(key: string): string {
  return format(parseISO(`${key}-01`), 'MMM yyyy');
}

export function inMonth(transactions: Transaction[], key: string) {
  return transactions.filter((tx) => tx.date.slice(0, 7) === key);
}

/**
 * Every month from the user's first entry through the current month.
 * Newest first — you can't scroll back further than you have data for.
 * `extraMonths` (yyyy-MM keys, e.g. hourly paycheck dates) can push the
 * start earlier than the oldest transaction; any month the contiguous range
 * then passes through is included automatically.
 */
export function availableMonths(
transactions: Transaction[],
today = new Date(),
extraMonths: string[] = [])
: string[] {
  const current = toMonthKey(today);
  const dates = [...transactions.map((tx) => tx.date), ...extraMonths.map((key) => `${key}-01`)];
  if (dates.length === 0) return [current];

  const earliest = dates.reduce((min, date) => date < min ? date : min, dates[0]);
  const [startYear, startMonth] = earliest.slice(0, 7).split('-').map(Number);
  const keys: string[] = [];
  let year = startYear;
  let month = startMonth;
  for (let i = 0; i < 240; i += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    keys.push(key);
    if (key === current) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  if (!keys.includes(current)) keys.push(current);
  return keys.reverse();
}

export function totalOf(transactions: Transaction[]) {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

export function totalsByParent(
transactions: Transaction[],
categories: Category[])
: Record<ParentCategory, number> {
  const totals: Record<ParentCategory, number> = { Needs: 0, Wants: 0, Savings: 0 };
  transactions.forEach((tx) => {
    const parent = categories.find((c) => c.id === tx.categoryId)?.parent;
    if (parent) totals[parent] += tx.amount;
  });
  return totals;
}

export function totalsByCategory(transactions: Transaction[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.categoryId] = (acc[tx.categoryId] ?? 0) + tx.amount;
    return acc;
  }, {});
}

export interface DayGroup {
  date: string;
  label: string;
  total: number;
  entries: Transaction[];
}

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const map = new Map<string, Transaction[]>();
  transactions.forEach((tx) => {
    map.set(tx.date, [...(map.get(tx.date) ?? []), tx]);
  });
  return Array.from(map.entries()).
  sort((a, b) => a[0] < b[0] ? 1 : -1).
  map(([date, entries]) => ({
    date,
    label: format(parseISO(date), 'EEEE, MMM d'),
    total: totalOf(entries),
    entries: [...entries].sort((a, b) => a.createdAt < b.createdAt ? 1 : -1)
  }));
}

export function usageByCategory(transactions: Transaction[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.categoryId] = (acc[tx.categoryId] ?? 0) + 1;
    return acc;
  }, {});
}

/** Group month keys (newest-first) by year for export UI. Years are newest-first. */
export function monthsByYear(months: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  months.forEach((key) => {
    const year = key.slice(0, 4);
    grouped[year] = grouped[year] ?? [];
    grouped[year].push(key);
  });
  return grouped;
}

export function yearsFromMonths(months: string[]): string[] {
  return [...new Set(months.map((key) => key.slice(0, 4)))];
}