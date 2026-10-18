import React from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { CHART_COLORS } from '../types/budget';
import { useBudget } from '../contexts/BudgetContext';
import { formatCurrency } from '../utils/format';

interface TopCategoriesProps {
  /** Category id → amount spent this month (manual + auto). */
  amounts: Record<string, number>;
}

/** Biggest lines get their own color; everything past this folds into one slice. */
const MAX_NAMED = 5;

interface Slice {
  key: string;
  name: string;
  amount: number;
  color: string;
  memberLabel?: string;
  /** Dollars over this category's monthly goal, when it has one and has blown it. */
  overBy: number;
  goal: number;
}

/**
 * One stacked bar showing how the month's spending splits across your biggest
 * categories, with a legend underneath. Ranked by dollars, so the big fixed
 * costs lead. Anything past the top five is rolled into "Everything else".
 * A warning icon marks any category that's over its own goal.
 */
export function TopCategories({ amounts }: TopCategoriesProps) {
  const { categories, isHousehold, memberById } = useBudget();

  const ranked = Object.entries(amounts).
  flatMap(([id, amount]) => {
    const category = categories.find((c) => c.id === id);
    return category && amount > 0 ? [{ category, amount }] : [];
  }).
  sort((a, b) => b.amount - a.amount);

  const slices: Slice[] = ranked.slice(0, MAX_NAMED).map(({ category, amount }, i) => {
    const member = isHousehold ? memberById(category.memberId) : undefined;
    const goal = category.monthlyGoal;
    return {
      key: category.id,
      name: category.name,
      amount,
      color: CHART_COLORS[i],
      memberLabel: member ? member.isSelf ? 'You' : member.name : undefined,
      overBy: goal > 0 && amount > goal ? amount - goal : 0,
      goal
    };
  });

  const restTotal = ranked.slice(MAX_NAMED).reduce((sum, r) => sum + r.amount, 0);
  if (restTotal > 0) {
    slices.push({
      key: 'everything-else',
      name: 'Everything else',
      amount: restTotal,
      color: CHART_COLORS[MAX_NAMED],
      overBy: 0,
      goal: 0
    });
  }

  const total = slices.reduce((sum, s) => sum + s.amount, 0);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">Top categories</h2>
        <p className="mt-0.5 text-[11px] text-subtle">
          Where this month&rsquo;s spending went, biggest first.
        </p>
      </div>

      {slices.length === 0 ?
      <p className="px-4 py-8 text-center text-xs text-subtle">Nothing logged yet.</p> :

      <div className="flex flex-col gap-4 px-4 py-4">
          <div
          className="flex h-3.5 gap-0.5"
          role="img"
          aria-label={`Spending by category: ${slices.
          map((s) => `${s.name} ${formatCurrency(s.amount, false)}`).
          join(', ')}`}>

            {slices.map((s) =>
          <div
            key={s.key}
            className="min-w-[4px] rounded"
            style={{ flex: `${s.amount} 0 0`, backgroundColor: s.color }}
            title={`${s.name}: ${Math.round(s.amount / total * 100)}% of spending`} />
          )}
          </div>

          <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5">
            {slices.map((s) =>
          <li key={s.key} className="flex min-w-0 items-center gap-2 text-[13px]">
                <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: s.color }}
              aria-hidden="true" />

                <span className="min-w-0 flex-1 truncate text-muted">
                  {s.name}
                  {s.memberLabel && <span className="text-subtle"> · {s.memberLabel}</span>}
                </span>
                {s.overBy > 0 &&
            <span
              className="shrink-0 text-alert"
              title={`${formatCurrency(s.overBy, false)} over a ${formatCurrency(s.goal, false)} goal`}>

                    <AlertTriangleIcon className="h-3 w-3" aria-label="Over goal" />
                  </span>
            }
                <span className="tabular shrink-0 font-semibold text-ink">
                  {formatCurrency(s.amount, false)}
                </span>
              </li>
          )}
          </ul>
        </div>
      }
    </section>);

}
