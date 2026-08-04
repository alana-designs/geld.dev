import { Transaction } from '../types/budget';
import { toMonthKey } from './rollups';

function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Projects each recurring transaction forward into month `key`, on the same
 * day-of-month it was originally logged (clamped to that month's length —
 * a bill logged on the 31st lands on the 28th/29th/30th in shorter months).
 * Never generates an instance in — or before — the transaction's own origin
 * month; that month already has the real, manually-logged entry.
 */
export function generateRecurringEntries(
transactions: Transaction[],
key: string,
today: Date = new Date())
: Transaction[] {
  const cutoff = toMonthKey(today) === key ? today.getDate() : daysInMonth(key);

  return transactions.
  filter((tx) => tx.recurring && key > tx.date.slice(0, 7)).
  map((tx): Transaction | null => {
    const anchorDay = Number(tx.date.slice(8, 10));
    const day = Math.min(anchorDay, daysInMonth(key));
    if (day > cutoff) return null;
    const date = `${key}-${String(day).padStart(2, '0')}`;
    return {
      ...tx,
      id: `recur-${tx.id}-${key}`,
      date,
      createdAt: `${date}T09:00:00.000Z`,
      auto: true,
      autoSource: 'recurring'
    };
  }).
  filter((tx): tx is Transaction => tx !== null);
}
