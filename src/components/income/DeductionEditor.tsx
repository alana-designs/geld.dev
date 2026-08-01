import React from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { Category } from '../../types/budget';
import { DeductionDraft } from '../../types/income';
import { sanitizeAmountInput } from '../../utils/format';

interface DeductionEditorProps {
  title: string;
  hint: string;
  rows: DeductionDraft[];
  savingsCategories: Category[];
  onChange: (rows: DeductionDraft[]) => void;
}

export function DeductionEditor({
  title,
  hint,
  rows,
  savingsCategories,
  onChange
}: DeductionEditorProps) {
  const patch = (id: string, next: Partial<DeductionDraft>) => {
    onChange(rows.map((row) => row.id === id ? { ...row, ...next } : row));
  };

  const add = () =>
  onChange([
  ...rows,
  { id: `d-${Date.now()}`, label: '', amount: '', tag: 'other' as const }]
  );

  return (
    <section className="rounded-card border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-subtle">{hint}</p>
      </div>

      <ul className="divide-y divide-line">
        {rows.map((row) => {
          const retirement = row.tag === 'retirement';
          return (
            <li key={row.id} className="px-3 py-2.5">

              <div className="flex items-center gap-2">
                <input
                  value={row.label}
                  onChange={(e) => patch(row.id, { label: e.target.value })}
                  placeholder="Label"
                  aria-label="Deduction label"
                  className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none placeholder:text-subtle focus:border-ink" />
                
                <div className="flex w-24 shrink-0 items-center rounded-control border border-line bg-surface px-2 focus-within:border-ink">
                  <span className="text-sm text-subtle">$</span>
                  <input
                    value={row.amount}
                    onChange={(e) =>
                    patch(row.id, { amount: sanitizeAmountInput(e.target.value) })
                    }
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="Deduction amount"
                    className="tabular w-full bg-transparent px-1 py-2 text-right text-sm text-ink outline-none" />
                  
                </div>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  aria-label={`Remove ${row.label || 'deduction'}`}
                  className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">
                  
                  <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <div className="flex rounded-full bg-canvas p-0.5" role="group" aria-label="Tag">
                  {(['retirement', 'other'] as const).map((tag) =>
                  <button
                    key={tag}
                    type="button"
                    onClick={() => patch(row.id, { tag })}
                    aria-pressed={row.tag === tag}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    row.tag === tag ?
                    tag === 'retirement' ?
                    'bg-savings text-white' :
                    'bg-surface text-ink' :
                    'text-subtle hover:text-ink'}`
                    }>
                    
                      {tag === 'retirement' ? 'Retirement / Savings' : 'Other'}
                    </button>
                  )}
                </div>

                {retirement &&
                <select
                  value={row.categoryId ?? savingsCategories[0]?.id ?? ''}
                  onChange={(e) => patch(row.id, { categoryId: e.target.value })}
                  aria-label="Savings category for auto entries"
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-ink outline-none focus:border-ink">
                  
                    {savingsCategories.map((c) =>
                  <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                  )}
                  </select>
                }
              </div>
            </li>);

        })}
      </ul>

      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink">
        
        <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
        Add line item
      </button>
    </section>);

}