import React from 'react';
import { PARENT_STYLES } from '../types/budget';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency } from '../utils/format';

interface TopCategoriesProps {
  /** Category id → amount spent this month (manual + auto). */
  amounts: Record<string, number>;
}

/**
 * Ranked by size, so the big fixed costs are the point rather than a
 * distortion. Each bar is relative to the largest line, not to income.
 */
export function TopCategories({ amounts }: TopCategoriesProps) {
  const { categories, isHousehold, memberById } = useBudget();

  const rows = Object.entries(amounts).
  map(([id, amount]) => ({ category: categories.find((c) => c.id === id), amount })).
  filter((row) => Boolean(row.category) && row.amount > 0).
  sort((a, b) => b.amount - a.amount).
  slice(0, 5);

  const max = rows[0]?.amount ?? 0;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Where it&rsquo;s going</h2>
        <p className="mt-0.5 text-[11px] text-subtle">Your five biggest lines this month.</p>
      </div>

      {rows.length === 0 ?
      <p className="px-4 py-8 text-center text-xs text-subtle">Nothing logged yet.</p> :

      <ul className="divide-y divide-line">
          {rows.map(({ category, amount }) => {
          if (!category) return null;
          const goal = category.monthlyGoal;
          const over = goal > 0 && amount > goal;
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
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${max > 0 ? amount / max * 100 : 0}%`,
                      backgroundColor: PARENT_STYLES[category.parent].hex
                    }} />

                  </div>
                  <span
                  className={`tabular shrink-0 text-[11px] ${over ? 'text-alert' : 'text-subtle'}`}>

                    {goal > 0 ?
                  over ?
                  `${formatCurrency(amount - goal, false)} over` :
                  `${formatCurrency(goal - amount, false)} left` :
                  'no goal'}
                  </span>
                </div>
              </li>);

        })}
        </ul>
      }
    </section>);

}
