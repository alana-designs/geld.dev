import React from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { PARENT_STYLES } from '../types/budget';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency } from '../utils/format';

interface TopCategoriesProps {
  /** Category id → amount spent this month (manual + auto). */
  amounts: Record<string, number>;
}

/**
 * Ranked by size, so the big fixed costs are the point rather than a
 * distortion. Rows stay ordered by dollars — these are your biggest lines —
 * while each bar reads as a share of that line's own goal, so a small category
 * that's blown its budget is as visible as a large one that hasn't.
 *
 * Categories with no goal get an empty track rather than a bar. Drawing them
 * relative to the largest line would put two different meanings on one axis,
 * which is the comparison problem this widget had before.
 */
export function TopCategories({ amounts }: TopCategoriesProps) {
  const { categories, isHousehold, memberById } = useBudget();

  const rows = Object.entries(amounts).
  map(([id, amount]) => ({ category: categories.find((c) => c.id === id), amount })).
  filter((row) => Boolean(row.category) && row.amount > 0).
  sort((a, b) => b.amount - a.amount).
  slice(0, 5);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Where it&rsquo;s going</h2>
        <p className="mt-0.5 text-[11px] text-subtle">
          Your five biggest lines, each against its own goal.
        </p>
      </div>

      {rows.length === 0 ?
      <p className="px-4 py-8 text-center text-xs text-subtle">Nothing logged yet.</p> :

      <ul className="divide-y divide-line">
          {rows.map(({ category, amount }) => {
          if (!category) return null;
          const goal = category.monthlyGoal;
          const hasGoal = goal > 0;
          const pct = hasGoal ? amount / goal * 100 : 0;
          const over = hasGoal && amount > goal;
          const member = isHousehold ? memberById(category.memberId) : undefined;

          return (
            <li key={category.id} className="px-4 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium tracking-[-0.01em] text-ink">
                      {category.name}
                    </span>
                    {member &&
                  <span className="shrink-0 text-[11px] text-muted">
                        {member.isSelf ? '· You' : `· ${member.name}`}
                      </span>
                  }
                  </span>
                  <span className="tabular shrink-0 text-[14px] font-semibold text-ink">
                    {formatCurrency(amount, false)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <div
                  className="h-1 flex-1 overflow-hidden rounded-full bg-line"
                  role={hasGoal ? 'progressbar' : undefined}
                  aria-valuenow={hasGoal ? Math.round(pct) : undefined}
                  aria-valuemin={hasGoal ? 0 : undefined}
                  aria-valuemax={hasGoal ? 100 : undefined}
                  aria-label={hasGoal ? `${category.name}: ${Math.round(pct)}% of goal used` : undefined}>

                    {hasGoal &&
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      // Fill caps at the track; the true figure is in the label,
                      // so 103% and 140% don't render identically to the eye.
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: over ? '#b1462d' : PARENT_STYLES[category.parent].hex
                    }} />
                  }
                  </div>

                  {hasGoal ?
                <span
                  className={`tabular flex shrink-0 items-center gap-1 text-[11px] ${
                  over ? 'font-semibold text-alert' : 'text-subtle'}`
                  }
                  title={
                  over ?
                  `${formatCurrency(amount - goal, false)} over a ${formatCurrency(goal, false)} goal` :
                  `${formatCurrency(goal - amount, false)} left of ${formatCurrency(goal, false)}`
                  }>

                      {Math.round(pct)}%
                      {over && <AlertTriangleIcon className="h-3 w-3" aria-hidden="true" />}
                    </span> :

                <span className="shrink-0 text-[11px] text-subtle">no goal</span>
                }
                </div>
              </li>);

        })}
        </ul>
      }
    </section>);

}
