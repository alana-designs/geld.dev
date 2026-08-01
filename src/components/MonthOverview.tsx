import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { PARENT_CATEGORIES, PARENT_STYLES, ParentCategory } from '../types/budget';
import { formatCurrency } from '../utils/format';

interface MonthOverviewProps {
  totals: Record<ParentCategory, number>;
  goals: Record<ParentCategory, number>;
  spent: number;
  takeHome: number;
  /** Payroll-funded savings — outside the take-home reconciliation. */
  autoSavings: number;
  activeParent: ParentCategory | null;
  onSelectParent: (parent: ParentCategory | null) => void;
}

export function MonthOverview({
  totals,
  goals,
  spent,
  takeHome,
  autoSavings,
  activeParent,
  onSelectParent
}: MonthOverviewProps) {
  const totalSavings = totals.Savings + autoSavings;
  const savingsRate = takeHome > 0 ? totalSavings / takeHome * 100 : 0;
  const remaining = takeHome - spent;
  const data = PARENT_CATEGORIES.map((p) => ({ name: p, value: totals[p] })).filter(
    (d) => d.value > 0
  );
  const chartData = data.length ? data : [{ name: 'empty', value: 1 }];

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="flex items-center gap-5 p-4">
        <div className="relative h-24 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={34}
                outerRadius={48}
                paddingAngle={data.length > 1 ? 1.5 : 0}
                stroke="none">
                
                {chartData.map((entry) =>
                <Cell
                  key={entry.name}
                  fill={
                  entry.name === 'empty' ?
                  '#eceae5' :
                  PARENT_STYLES[entry.name as ParentCategory].hex
                  }
                  opacity={
                  activeParent && entry.name !== activeParent && entry.name !== 'empty' ?
                  0.22 :
                  1
                  }
                  onClick={() =>
                  entry.name !== 'empty' &&
                  onSelectParent(
                    activeParent === entry.name ? null : entry.name as ParentCategory
                  )
                  }
                  className="cursor-pointer outline-none" />

                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-subtle">
              Spent
            </span>
            <span className="tabular text-sm font-semibold tracking-[-0.02em] text-ink">
              {formatCurrency(spent, false)}
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            Left to spend
          </p>
          <p
            className={`tabular text-3xl font-bold leading-tight tracking-[-0.03em] ${
            remaining < 0 ? 'text-alert' : 'text-ink'}`
            }>
            
            {formatCurrency(remaining, false)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            of {formatCurrency(takeHome, false)} take-home
          </p>
        </div>
      </div>

      <div className="border-t border-line px-1.5 py-1.5">
        {PARENT_CATEGORIES.map((p) => {
          const goal = goals[p];
          const value = p === 'Savings' ? totalSavings : totals[p];
          const over = goal > 0 && value > goal;
          const active = activeParent === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onSelectParent(active ? null : p)}
              aria-pressed={active}
              className={`w-full rounded-control px-2.5 py-2 text-left transition-colors ${
              active ? 'bg-canvas ring-1 ring-line' : 'hover:bg-canvas'}`
              }>
              
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PARENT_STYLES[p].hex }}
                    aria-hidden="true" />
                  
                  {p}
                </span>
                <span className="tabular text-xs text-subtle">
                  <span className={`font-semibold ${over ? 'text-alert' : 'text-ink'}`}>
                    {formatCurrency(value, false)}
                  </span>{' '}
                  / {formatCurrency(goal, false)}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${goal > 0 ? Math.min(value / goal * 100, 100) : 0}%`,
                    backgroundColor: over ? '#b1462d' : PARENT_STYLES[p].hex
                  }} />
                
              </div>
            </button>);

        })}
      </div>

      {autoSavings > 0 &&
      <div className="flex items-baseline justify-between border-t border-line px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink">Total savings rate</p>
            <p className="text-[11px] leading-relaxed text-subtle">
              incl. {formatCurrency(autoSavings, false)} auto from paycheck
            </p>
          </div>
          <p className="tabular shrink-0 text-right text-sm font-semibold text-savings">
            {formatCurrency(totalSavings, false)}
            <span className="block text-[11px] font-normal text-subtle">
              {savingsRate.toFixed(0)}% of take-home
            </span>
          </p>
        </div>
      }

      <Link
        to="/budget"
        className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink">
        
        Manage categories &amp; goals
        <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </section>);

}