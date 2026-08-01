import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
  PlusIcon,
  WalletIcon } from
'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { PARENT_CATEGORIES, PARENT_STYLES, ParentCategory } from '../types/budget';
import { formatCurrency } from '../utils/format';
import { IncomeSourceSheet } from './income/IncomeSourceSheet';

/**
 * First-run setup. The categories chosen here are the same ones the Budget
 * section manages and the add-expense sheet offers — one shared list.
 */
export function OnboardingSetup() {
  const { categories, addCategory, updateCategory, completeSetup, takeHome, incomeSources } =
  useBudget();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [incomeOpen, setIncomeOpen] = useState(false);

  const selected = useMemo(() => categories.filter((c) => !c.archived), [categories]);
  const goalTotal = selected.reduce((sum, c) => sum + c.monthlyGoal, 0);

  const commitGoal = (id: string, value: string) => {
    const parsed = Number(value);
    updateCategory(id, { monthlyGoal: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
  };

  const addCustom = (parent: ParentCategory) => {
    const value = (newName[parent] ?? '').trim();
    if (!value) return;
    addCategory(value, parent);
    setNewName((prev) => ({ ...prev, [parent]: '' }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
              Setup · Step {step + 1} of 3
            </p>
            <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink">
              {step === 0 ?
              'Pick your categories' :
              step === 1 ?
              'Set monthly goals' :
              'Add your paycheck'}
            </h1>
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) =>
            <span
              key={i}
              className={`h-1.5 w-5 rounded-full ${step === i ? 'bg-primary' : 'bg-line'}`} />

            )}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {step === 0 ?
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm leading-relaxed text-muted">
                These become your subcategories everywhere — the Budget section and the add-expense
                keypad both read from this list. Tap to turn one off, or add your own.
              </p>

              <div className="mt-4 space-y-3">
                {PARENT_CATEGORIES.map((parent) => {
                const rows = categories.filter((c) => c.parent === parent);
                return (
                  <section
                    key={parent}
                    className="rounded-card border border-line bg-surface p-4">
                    
                      <div className="flex items-center gap-2">
                        <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PARENT_STYLES[parent].hex }}
                        aria-hidden="true" />
                      
                        <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
                          {parent}
                        </h2>
                        <span className="text-xs text-subtle">{PARENT_STYLES[parent].blurb}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {rows.map((c) => {
                        const on = !c.archived;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => updateCategory(c.id, { archived: on })}
                            aria-pressed={on}
                            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
                            on ?
                            'border-ink bg-ink font-medium text-white' :
                            'border-line bg-surface text-subtle hover:text-ink'}`
                            }>
                            
                              {on && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
                              {c.name}
                            </button>);

                      })}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input
                        value={newName[parent] ?? ''}
                        onChange={(e) =>
                        setNewName((prev) => ({ ...prev, [parent]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && addCustom(parent)}
                        placeholder={`Add a ${parent} category`}
                        aria-label={`Add a ${parent} category`}
                        className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink" />
                      
                        <button
                        type="button"
                        onClick={() => addCustom(parent)}
                        className="flex shrink-0 items-center gap-1 rounded-control border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas">
                        
                          <PlusIcon className="h-4 w-4" aria-hidden="true" />
                          Add
                        </button>
                      </div>
                    </section>);

              })}
              </div>
            </motion.div> :
          step === 1 ?
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm leading-relaxed text-muted">
                Optional, but this is what makes goal-vs-actual work. You can change any of these
                later in Budget.
              </p>

              <div className="mt-4 space-y-3">
                {PARENT_CATEGORIES.map((parent) => {
                const rows = selected.filter((c) => c.parent === parent);
                if (rows.length === 0) return null;
                return (
                  <section
                    key={parent}
                    className="overflow-hidden rounded-card border border-line bg-surface">
                    
                      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                        <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: PARENT_STYLES[parent].hex }}
                        aria-hidden="true" />
                      
                        <h2 className="text-sm font-semibold text-ink">{parent}</h2>
                      </div>
                      <ul className="divide-y divide-line">
                        {rows.map((c) =>
                      <li key={c.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">
                              {c.name}
                            </span>
                            <div className="flex w-28 items-center rounded-control border border-line px-2 focus-within:border-ink">
                              <span className="text-sm text-subtle">$</span>
                              <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            value={drafts[c.id] ?? (c.monthlyGoal || '')}
                            onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            onBlur={(e) => commitGoal(c.id, e.target.value)}
                            aria-label={`Monthly goal for ${c.name}`}
                            className="tabular w-full bg-transparent px-1 py-2 text-right text-sm text-ink outline-none" />
                          
                            </div>
                          </li>
                      )}
                      </ul>
                    </section>);

              })}
              </div>

              <div className="mt-3 flex items-baseline justify-between rounded-card border border-line bg-surface px-4 py-3">
                <span className="text-sm text-muted">Budgeted</span>
                <span className="tabular text-sm font-semibold text-ink">
                  {formatCurrency(goalTotal, false)}{' '}
                  <span className="font-normal text-subtle">
                    of {formatCurrency(takeHome, false)}
                  </span>
                </span>
              </div>
            </motion.div> :

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm leading-relaxed text-muted">
                Budgets should sit on real take-home pay, not gross salary. Upload a paystub and
                review what we read off it, or type the numbers in yourself.
              </p>

              {incomeSources.length > 0 ?
            <section className="mt-4 rounded-card border border-line bg-surface p-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                    Monthly take-home
                  </p>
                  <p className="tabular text-3xl font-bold tracking-[-0.03em] text-ink">
                    {formatCurrency(takeHome, false)}
                  </p>
                  <ul className="mt-3 space-y-1 border-t border-line pt-3">
                    {incomeSources.map((source) =>
                <li
                  key={source.id}
                  className="flex items-center justify-between text-xs text-muted">
                  
                        <span className="truncate">{source.name}</span>
                        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-needs" aria-hidden="true" />
                      </li>
                )}
                  </ul>
                  <button
                type="button"
                onClick={() => setIncomeOpen(true)}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
                
                    <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Add another income source
                  </button>
                </section> :

            <button
              type="button"
              onClick={() => setIncomeOpen(true)}
              className="mt-4 flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition-colors hover:border-ink/30">
              
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary">
                    <WalletIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">Set up income</span>
                    <span className="block text-xs text-muted">
                      Upload a paystub or enter it by hand
                    </span>
                  </span>
                </button>
            }

              <p className="mt-3 flex items-start gap-2 px-1 text-[11px] leading-relaxed text-subtle">
                <FileTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                A paystub is a document you hand over once — never a bank connection. Nothing saves
                until you confirm each line.
              </p>
            </motion.div>
          }
        </div>
      </div>

      <footer
        className="shrink-0 border-t border-line bg-surface px-4 py-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          {step > 0 &&
          <button
            type="button"
            onClick={() => setStep(step - 1 as 0 | 1)}
            aria-label="Back"
            className="flex h-12 items-center gap-1.5 rounded-control border border-line px-4 text-sm font-medium text-muted transition-colors hover:text-ink">
            
              <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          }
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => step === 2 ? completeSetup() : setStep(step + 1 as 1 | 2)}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-control bg-primary text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:bg-line disabled:text-subtle">
            
            {selected.length === 0 ?
            'Pick at least one category' :
            step === 0 ?
            `Continue with ${selected.length} categories` :
            step === 1 ?
            'Next: your paycheck' :
            incomeSources.length > 0 ?
            'Start tracking' :
            'Skip for now'}
            {selected.length > 0 && <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </footer>

      <IncomeSourceSheet open={incomeOpen} source={null} onClose={() => setIncomeOpen(false)} />
    </div>);

}