import React, { useMemo, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { PARENT_CATEGORIES, PARENT_STYLES, ParentCategory, Transaction } from '../types/budget';
import { groupByDay, inMonth, monthLabel } from '../utils/rollups';
import { formatCurrency } from '../utils/format';
import { EntryRow } from '../components/EntryRow';
import { EntrySheet } from '../components/EntrySheet';
import { MonthPicker } from '../components/MonthPicker';
import { MemberTabs } from '../components/MemberTabs';
import { AddExpenseButton } from '../components/AddExpenseButton';

interface ActivityProps {
  onAdd: () => void;
}

export function Activity({ onAdd }: ActivityProps) {
  const {
    transactions,
    categoryById,
    deleteTransaction,
    months,
    selectedMonth,
    setSelectedMonth,
    autoEntriesFor,
    recurringEntriesFor,
    canEdit,
    isHousehold,
    memberById
  } = useBudget();
  const [query, setQuery] = useState('');
  const [parent, setParent] = useState<ParentCategory | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const searching = query.trim().length > 0;

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Searching spans every month; browsing stays in the selected month.
    const auto = searching ?
    months.flatMap((key) => [...autoEntriesFor(key), ...recurringEntriesFor(key)]) :
    [...autoEntriesFor(selectedMonth), ...recurringEntriesFor(selectedMonth)];
    const scope = searching ?
    [...transactions, ...auto] :
    [...inMonth(transactions, selectedMonth), ...auto];
    const filtered = scope.filter((tx) => {
      const category = categoryById(tx.categoryId);
      const matchesParent = !parent || category?.parent === parent;
      const matchesQuery =
      !q ||
      tx.description.toLowerCase().includes(q) || (
      category?.name.toLowerCase().includes(q) ?? false);
      return matchesParent && matchesQuery;
    });
    return groupByDay(filtered);
  }, [
  transactions,
  query,
  parent,
  categoryById,
  selectedMonth,
  searching,
  months,
  autoEntriesFor,
  recurringEntriesFor]
  );

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            {searching ? 'All months' : monthLabel(selectedMonth)}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink">Activity</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MonthPicker months={months} value={selectedMonth} onChange={setSelectedMonth} />
          {canEdit && <AddExpenseButton onClick={onAdd} />}
        </div>
      </header>

      <MemberTabs />

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          aria-hidden="true" />
        
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search descriptions across all months"
          aria-label="Search entries"
          className="w-full rounded-control border border-line bg-surface py-3 pl-10 pr-10 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink" />
        
        {query &&
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-subtle hover:text-ink">
          
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
        <FilterChip active={parent === null} onClick={() => setParent(null)} label="All" />
        {PARENT_CATEGORIES.map((p) =>
        <FilterChip
          key={p}
          active={parent === p}
          onClick={() => setParent(parent === p ? null : p)}
          label={p}
          color={PARENT_STYLES[p].hex} />

        )}
      </div>

      {days.length === 0 ?
      <div className="rounded-card border border-dashed border-line bg-surface px-4 py-12 text-center">
          <p className="text-sm font-semibold text-ink">No matching entries</p>
          <p className="mt-1 text-xs text-muted">
            {searching ? 'Try a different word.' : 'Nothing logged in this month yet.'}
          </p>
        </div> :

      <div className="space-y-2.5">
          {days.map((day) =>
        <section
          key={day.date}
          className="overflow-hidden rounded-card border border-line bg-surface">
          
              <div className="flex items-baseline justify-between bg-canvas px-4 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-subtle">
                  {day.label}
                </span>
                <span className="tabular text-[11px] font-semibold text-muted">
                  {formatCurrency(day.total)}
                </span>
              </div>
              <ul>
                {day.entries.map((tx) =>
            <EntryRow
              key={tx.id}
              transaction={tx}
              category={categoryById(tx.categoryId)}
              member={isHousehold ? memberById(tx.memberId) : undefined}
              onEdit={canEdit ? setEditing : undefined}
              onDelete={canEdit ? deleteTransaction : undefined} />

            )}
              </ul>
            </section>
        )}
        </div>
      }

      <EntrySheet
        open={Boolean(editing)}
        transaction={editing}
        onClose={() => setEditing(null)} />
      
    </div>);

}

function FilterChip({
  active,
  onClick,
  label,
  color





}: {active: boolean;onClick: () => void;label: string;color?: string;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
      active ? 'border-transparent text-white' : 'border-line bg-surface text-muted'}`
      }
      style={active ? { backgroundColor: color ?? '#38352f' } : undefined}>
      
      {label}
    </button>);

}