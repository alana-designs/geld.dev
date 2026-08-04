import React, { useMemo, useState } from 'react';
import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { Category, PARENT_CATEGORIES, PARENT_STYLES, ParentCategory } from '../types/budget';
import { inMonth, monthLabel, totalsByCategory } from '../utils/rollups';
import { formatCurrency } from '../utils/format';
import { GoalBar } from '../components/GoalBar';
import { MonthPicker } from '../components/MonthPicker';
import { CategoryEditorSheet } from '../components/CategoryEditorSheet';
import { MemberTabs } from '../components/MemberTabs';

export function Budget() {
  const {
    categories,
    transactions,
    months,
    selectedMonth,
    setSelectedMonth,
    takeHome,
    autoEntriesFor,
    recurringEntriesFor,
    canEdit,
    isHousehold,
    viewMember,
    memberById
  } = useBudget();
  const [showArchived, setShowArchived] = useState(false);
  const [editor, setEditor] = useState<{
    open: boolean;
    category: Category | null;
    parent: ParentCategory;
  }>({ open: false, category: null, parent: 'Needs' });

  // Recurring-expense projections count as real spend against the goal.
  const spentByCategory = useMemo(
    () =>
    totalsByCategory([
    ...inMonth(transactions, selectedMonth),
    ...recurringEntriesFor(selectedMonth)]
    ),
    [transactions, selectedMonth, recurringEntriesFor]
  );

  // Payroll-funded savings count toward a Savings goal, but stay labelled.
  const autoByCategory = useMemo(
    () => totalsByCategory(autoEntriesFor(selectedMonth)),
    [autoEntriesFor, selectedMonth]
  );
  const amountFor = (id: string) => (spentByCategory[id] ?? 0) + (autoByCategory[id] ?? 0);

  const budgeted = categories.
  filter((c) => !c.archived).
  reduce((sum, c) => sum + c.monthlyGoal, 0);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            {monthLabel(selectedMonth)}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink">
            {isHousehold ?
            'Household budget' :
            viewMember && !viewMember.isSelf ?
            `${viewMember.name}'s budget` :
            'Budget'}
          </h1>
        </div>
        <MonthPicker months={months} value={selectedMonth} onChange={setSelectedMonth} />
      </header>

      <MemberTabs />

      <div className="flex items-baseline justify-between rounded-card border border-line bg-surface px-4 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            Budgeted
          </p>
          <p className="tabular text-xl font-bold tracking-[-0.03em] text-ink">
            {formatCurrency(budgeted, false)}
          </p>
        </div>
        <p className="text-xs text-muted">of {formatCurrency(takeHome, false)} take-home</p>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted">
        {isHousehold ?
        `Everyone's categories and goals, combined for ${monthLabel(selectedMonth)}. Each person edits their own.` :
        canEdit || !viewMember ?
        `These categories are what you'll see when adding an expense. Goals carry over month to month; the amounts below are what you actually spent in ${monthLabel(selectedMonth)}.` :
        `${viewMember.name}'s categories and goals for ${monthLabel(selectedMonth)}. You can look, but only they can change these.`}
      </p>

      {PARENT_CATEGORIES.map((parent) => {
        const rows = categories.
        filter((c) => c.parent === parent && (showArchived || !c.archived)).
        sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
        const active = categories.filter((c) => c.parent === parent && !c.archived);
        const goalTotal = active.reduce((s, c) => s + c.monthlyGoal, 0);
        const spentTotal = active.reduce((s, c) => s + amountFor(c.id), 0);
        const autoTotal = active.reduce((s, c) => s + (autoByCategory[c.id] ?? 0), 0);
        const over = goalTotal > 0 && spentTotal > goalTotal;

        return (
          <section
            key={parent}
            className="overflow-hidden rounded-card border border-line bg-surface">
            
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: PARENT_STYLES[parent].hex }}
                    aria-hidden="true" />
                  
                  {parent}
                </h2>
                <p className="tabular mt-0.5 text-xs text-subtle">
                  <span className={`font-semibold ${over ? 'text-alert' : 'text-ink'}`}>
                    {formatCurrency(spentTotal, false)}
                  </span>{' '}
                  spent of {formatCurrency(goalTotal, false)}
                  {autoTotal > 0 &&
                  <span className="text-subtle">
                      {' '}
                      · incl. {formatCurrency(autoTotal, false)} auto
                    </span>
                  }
                </p>
              </div>
              {canEdit &&
              <button
                type="button"
                onClick={() => setEditor({ open: true, category: null, parent })}
                className="flex shrink-0 items-center gap-1 rounded-control border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas">
                
                  <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Add
                </button>
              }
            </div>

            {rows.length === 0 ?
            <p className="px-4 py-6 text-center text-xs text-subtle">
                No {parent} categories yet.
              </p> :

            <ul className="divide-y divide-line">
                {rows.map((c) => {
                const spent = amountFor(c.id);
                const auto = autoByCategory[c.id] ?? 0;
                const isOver = c.monthlyGoal > 0 && spent > c.monthlyGoal;
                return (
                  <li key={c.id}>
                      <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setEditor({ open: true, category: c, parent })}
                      className="w-full px-4 py-2.5 text-left transition-colors enabled:hover:bg-canvas">
                      
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                            className={`truncate text-[15px] font-medium tracking-[-0.01em] ${
                            c.archived ? 'text-subtle line-through' : 'text-ink'}`
                            }>
                            
                              {c.name}
                            </span>
                            {c.archived &&
                          <span className="shrink-0 rounded border border-line px-1 text-[10px] uppercase tracking-wide text-subtle">
                                Archived
                              </span>
                          }
                            {isHousehold &&
                          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                                <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: memberById(c.memberId)?.color ?? '#a1a1aa'
                              }}
                              aria-hidden="true" />
                            
                                {memberById(c.memberId)?.isSelf ?
                            'You' :
                            memberById(c.memberId)?.name}
                              </span>
                          }
                          </span>
                          <span className="tabular flex shrink-0 items-center gap-1 text-xs text-subtle">
                            <span className={`font-semibold ${isOver ? 'text-alert' : 'text-ink'}`}>
                              {formatCurrency(spent, false)}
                            </span>
                            {c.monthlyGoal > 0 ?
                          <>/ {formatCurrency(c.monthlyGoal, false)}</> :
                          canEdit ?
                          <span className="text-primary underline decoration-line underline-offset-2">
                                set goal
                              </span> :

                          <>/ no goal</>
                          }
                            {canEdit &&
                          <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          }
                          </span>
                        </div>
                        <div className="mt-2">
                          <GoalBar parent={parent} spent={spent} goal={c.monthlyGoal} />
                        </div>
                        {auto > 0 &&
                      <p className="mt-1 text-[11px] text-subtle">
                            {formatCurrency(auto)} auto from paycheck
                          </p>
                      }
                        {isOver &&
                      <p className="mt-1 text-[11px] text-alert">
                            {formatCurrency(spent - c.monthlyGoal)} over goal
                          </p>
                      }
                      </button>
                    </li>);

              })}
              </ul>
            }
          </section>);

      })}

      <button
        type="button"
        onClick={() => setShowArchived((v) => !v)}
        className="w-full rounded-control border border-line bg-surface py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink">
        
        {showArchived ? 'Hide archived categories' : 'Show archived categories'}
      </button>

      <CategoryEditorSheet
        open={editor.open}
        category={editor.category}
        defaultParent={editor.parent}
        onClose={() => setEditor((prev) => ({ ...prev, open: false }))} />
      
    </div>);

}