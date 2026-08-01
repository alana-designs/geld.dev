import React from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency } from '../utils/format';

interface HouseholdBreakdownProps {
  monthKey: string;
}

/** Who contributed what this month — spending and take-home, side by side. */
export function HouseholdBreakdown({ monthKey }: HouseholdBreakdownProps) {
  const { totalsByMember, setViewId } = useBudget();
  const rows = totalsByMember(monthKey);
  const combinedSpent = rows.reduce((sum, r) => sum + r.spent, 0);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">By person</h2>
        <p className="mt-0.5 text-[11px] text-subtle">
          Each person keeps their own categories and paycheck — this just adds them up.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {rows.map(({ member, spent, takeHome, autoSavings }) => {
          const share = combinedSpent > 0 ? spent / combinedSpent * 100 : 0;
          return (
            <li key={member.id}>
              <button
                type="button"
                onClick={() => setViewId(member.id)}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-canvas">
                
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: member.color }}
                      aria-hidden="true" />
                    
                    <span className="truncate text-[15px] font-medium tracking-[-0.01em] text-ink">
                      {member.isSelf ? 'You' : member.name}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-right text-sm font-semibold text-ink">
                    {formatCurrency(spent, false)}
                    <span className="block text-[11px] font-normal text-subtle">
                      of {formatCurrency(takeHome, false)} take-home
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${share}%`, backgroundColor: member.color }} />
                  
                </div>
                {autoSavings > 0 &&
                <p className="mt-1 text-[11px] text-subtle">
                    + {formatCurrency(autoSavings, false)} auto savings from payroll
                  </p>
                }
              </button>
            </li>);

        })}
      </ul>
    </section>);

}