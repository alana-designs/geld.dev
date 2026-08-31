import * as XLSX from 'xlsx';
import { Category, Member, Transaction } from '../types/budget';
import { generateRecurringEntries } from './recurring';
import { inMonth, monthLabel } from './rollups';

export interface ExportRow {
  Date: string;
  Month: string;
  Description: string;
  Amount: number;
  Category: string;
  Type: string;
  Member: string;
  Recurring: string;
  Source: string;
}

export interface ExportInput {
  monthKeys: string[];
  memberIds: string[];
  transactions: Transaction[];
  categories: Category[];
  /** Payroll savings rows, generated server-side and kept out of
   *  `transactions` — pass BudgetContext's `allAutoEntries`. */
  autoEntries: Transaction[];
  memberById: (id: string) => Member | undefined;
}

function entrySource(tx: Transaction): string {
  if (tx.auto && tx.autoSource === 'recurring') return 'Recurring projection';
  if (tx.auto && tx.autoSource === 'income') return 'Payroll savings';
  return 'Manual';
}

function recurringLabel(tx: Transaction): string {
  if (tx.auto && tx.autoSource === 'recurring') return 'Yes';
  return tx.recurring ? 'Yes' : 'No';
}

function memberName(memberById: (id: string) => Member | undefined, memberId: string): string {
  const member = memberById(memberId);
  if (!member) return 'Unknown';
  return member.isSelf ? 'You' : member.name;
}

/** Gather all entries for export across selected months and members. */
export function buildExportRows(input: ExportInput): ExportRow[] {
  const {
    monthKeys,
    memberIds,
    transactions,
    categories,
    autoEntries,
    memberById
  } = input;
  const memberSet = new Set(memberIds);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const rows: ExportRow[] = [];

  monthKeys.forEach((monthKey) => {
    memberIds.forEach((memberId) => {
      const memberTransactions = transactions.filter((tx) => tx.memberId === memberId);
      const manual = inMonth(memberTransactions, monthKey);
      const recurring = generateRecurringEntries(memberTransactions, monthKey);
      const auto = inMonth(autoEntries.filter((tx) => tx.memberId === memberId), monthKey);
      const entries = [...manual, ...recurring, ...auto].filter((tx) => memberSet.has(tx.memberId));

      entries.forEach((tx) => {
        const category = categoryById.get(tx.categoryId);
        rows.push({
          Date: tx.date,
          Month: monthLabel(tx.date.slice(0, 7)),
          Description: tx.description,
          Amount: tx.amount,
          Category: category?.name ?? 'Unknown',
          Type: category?.parent ?? 'Unknown',
          Member: memberName(memberById, tx.memberId),
          Recurring: recurringLabel(tx),
          Source: entrySource(tx)
        });
      });
    });
  });

  return rows.sort((a, b) => a.Date.localeCompare(b.Date) || a.Description.localeCompare(b.Description));
}

/** Build a filename from the selected month keys. */
export function exportFilename(monthKeys: string[]): string {
  if (monthKeys.length === 0) return 'expense-tracker_export.xlsx';
  const sorted = [...monthKeys].sort();
  const start = sorted[0];
  const end = sorted[sorted.length - 1];
  const range = start === end ? start : `${start}_to_${end}`;
  return `expense-tracker_${range}.xlsx`;
}

/** Write rows to an .xlsx file and trigger a browser download. */
export function downloadExcel(rows: ExportRow[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  XLSX.writeFile(workbook, filename);
}
