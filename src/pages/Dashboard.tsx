import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { ParentCategory, Transaction } from '../types/budget';
import {
  cumulativeByDay,
  groupByDay,
  inMonth,
  monthLabel,
  totalOf,
  totalsByParent } from
'../utils/rollups';
import { formatCurrency } from '../utils/format';
import { MonthOverview } from '../components/MonthOverview';
import { MonthPicker } from '../components/MonthPicker';
import { SpendTrend } from '../components/SpendTrend';
import { EntryRow } from '../components/EntryRow';
import { EntrySheet } from '../components/EntrySheet';
import { MemberTabs } from '../components/MemberTabs';
import { HouseholdBreakdown } from '../components/HouseholdBreakdown';

interface DashboardProps {
  onAdd: () => void;
}

export function Dashboard({ onAdd }: DashboardProps) {
  const {
    transactions,
    categories,
    takeHome,
    categoryById,
    deleteTransaction,
    months,
    selectedMonth,
    setSelectedMonth,
    autoEntriesFor,
    canEdit,
    isHousehold,
    viewMember,
    memberById
  } = useBudget();
  const [activeParent, setActiveParent] = useState<ParentCategory | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const monthTx = useMemo(() => inMonth(transactions, selectedMonth), [transactions, selectedMonth]);
  const totals = useMemo(() => totalsByParent(monthTx, categories), [monthTx, categories]);
  const goals = useMemo(() => {
    const g: Record<ParentCategory, number> = { Needs: 0, Wants: 0, Savings: 0 };
    categories.forEach((c) => {
      if (!c.archived) g[c.parent] += c.monthlyGoal;
    });
    return g;
  }, [categories]);

  // Payroll savings show up as entries but stay out of the take-home math.
  const autoTx = useMemo(() => autoEntriesFor(selectedMonth), [autoEntriesFor, selectedMonth]);
  const autoSavings = totalOf(autoTx);

  const spent = totalOf(monthTx);
  const trend = useMemo(() => cumulativeByDay(monthTx, selectedMonth), [monthTx, selectedMonth]);
  const pace = trend.length ? spent / trend.length : 0;

  const filtered = useMemo(() => {
    const all = [...monthTx, ...autoTx];
    if (!activeParent) return all;
    return all.filter((tx) => categoryById(tx.categoryId)?.parent === activeParent);
  }, [monthTx, autoTx, activeParent, categoryById]);

  const recentDays = useMemo(() => groupByDay(filtered).slice(0, 3), [filtered]);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            {monthLabel(selectedMonth)}
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink">
            {isHousehold ? 'Household' : viewMember && !viewMember.isSelf ? viewMember.name : 'Overview'}
          </h1>
        </div>
        <MonthPicker months={months} value={selectedMonth} onChange={setSelectedMonth} />
      </header>

      <MemberTabs />

      <MonthOverview
        totals={totals}
        goals={goals}
        spent={spent}
        takeHome={takeHome}
        autoSavings={autoSavings}
        activeParent={activeParent}
        onSelectParent={setActiveParent} />
      

      {isHousehold && <HouseholdBreakdown monthKey={selectedMonth} />}

      <SpendTrend data={trend} pace={pace} />

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
            {activeParent ? `${activeParent} entries` : 'Recent entries'}
          </h2>
          {activeParent &&
          <button
            type="button"
            onClick={() => setActiveParent(null)}
            className="text-xs font-medium text-primary underline decoration-line underline-offset-2">
            
              Clear filter
            </button>
          }
        </div>

        {recentDays.length === 0 ?
        <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-ink">Nothing logged this month</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
              {canEdit ?
            'Every dollar in here gets typed in on purpose — no bank linking, ever.' :
            'Nothing has been logged on this tab yet.'}
            </p>
            {canEdit &&
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            
                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                Add an entry
              </button>
          }
          </div> :

        recentDays.map((day) =>
        <div key={day.date}>
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
            </div>
        )
        }

        <Link
          to="/activity"
          className="flex items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink">
          
          See all activity
          <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>

      <EntrySheet
        open={Boolean(editing)}
        transaction={editing}
        onClose={() => setEditing(null)} />
      
    </div>);

}