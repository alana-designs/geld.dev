import * as XLSX from 'xlsx';
import { Category, Transaction } from '../types/budget';
import { generateRecurringEntries } from './recurring';
import { inMonth, shortMonthLabel, toMonthKey } from './rollups';

/**
 * Excel export of the signed-in user's own activity — one sheet per month.
 *
 * Privacy: this module deliberately has no notion of "other members".
 * Everything is filtered to `selfId` up front, so even though BudgetContext
 * holds the whole household's rows, nothing belonging to a household member
 * can reach the workbook.
 */

export interface ExportRow {
  Date: string;
  /** yyyy-MM — handy when sheets are stacked together for month-over-month analysis. */
  Month: string;
  Note: string;
  Amount: number;
  Category: string;
  /** Needs / Wants / Savings */
  Type: string;
  Recurring: string;
  Source: string;
}

export interface MonthSheet {
  monthKey: string;
  rows: ExportRow[];
}

export interface ExportInput {
  /** The signed-in user. Only rows owned by this id are exported. */
  selfId: string;
  transactions: Transaction[];
  /** Payroll savings rows (BudgetContext's `allAutoEntries`). */
  autoEntries: Transaction[];
  categories: Category[];
  today?: Date;
}

const COLUMNS: (keyof ExportRow)[] = [
  'Date',
  'Month',
  'Note',
  'Amount',
  'Category',
  'Type',
  'Recurring',
  'Source'];


function entrySource(tx: Transaction): string {
  if (tx.auto && tx.autoSource === 'recurring') return 'Recurring projection';
  if (tx.auto && tx.autoSource === 'income') return 'Payroll savings';
  return 'Manual';
}

function recurringLabel(tx: Transaction): string {
  if (tx.auto && tx.autoSource === 'recurring') return 'Yes';
  return tx.recurring ? 'Yes' : 'No';
}

/** Every yyyy-MM key from `start` through `end`, oldest first. */
function monthKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || year === endYear && month <= endMonth) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

/** One entry per month that has activity, oldest first. Own data only. */
export function buildMonthSheets(input: ExportInput): MonthSheet[] {
  const { selfId, today = new Date() } = input;

  // The privacy boundary: drop everything that isn't the signed-in user's.
  const own = input.transactions.filter((tx) => tx.memberId === selfId);
  const ownAuto = input.autoEntries.filter((tx) => tx.memberId === selfId);
  const categoryById = new Map(
    input.categories.filter((c) => c.memberId === selfId).map((c) => [c.id, c])
  );

  const dated = [...own, ...ownAuto];
  if (dated.length === 0) return [];

  const dates = dated.map((tx) => tx.date.slice(0, 7)).sort();
  const currentMonth = toMonthKey(today);
  const first = dates[0];
  const last = dates[dates.length - 1] > currentMonth ? dates[dates.length - 1] : currentMonth;

  const sheets: MonthSheet[] = [];
  monthKeysBetween(first, last).forEach((monthKey) => {
    const entries = [
    ...inMonth(own, monthKey),
    ...generateRecurringEntries(own, monthKey, today),
    ...inMonth(ownAuto, monthKey)];

    if (entries.length === 0) return;

    const rows = entries.
    map((tx): ExportRow => {
      const category = categoryById.get(tx.categoryId);
      return {
        Date: tx.date,
        Month: monthKey,
        Note: tx.description,
        Amount: tx.amount,
        Category: category?.name ?? 'Unknown',
        Type: category?.parent ?? 'Unknown',
        Recurring: recurringLabel(tx),
        Source: entrySource(tx)
      };
    }).
    sort((a, b) => a.Date.localeCompare(b.Date) || a.Note.localeCompare(b.Note));

    sheets.push({ monthKey, rows });
  });

  return sheets;
}

/** e.g. geld-activity_2026-10-07.xlsx */
export function exportFilename(today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `geld-activity_${y}-${m}-${d}.xlsx`;
}

/** Write one worksheet per month and trigger a browser download. */
export function downloadExcel(sheets: MonthSheet[], filename: string) {
  if (sheets.length === 0) return;
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ monthKey, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
    worksheet['!cols'] = [
    { wch: 11 }, // Date
    { wch: 9 }, // Month
    { wch: 36 }, // Note
    { wch: 11 }, // Amount
    { wch: 20 }, // Category
    { wch: 9 }, // Type
    { wch: 10 }, // Recurring
    { wch: 22 } // Source
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, shortMonthLabel(monthKey));
  });
  XLSX.writeFile(workbook, filename);
}
