import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { ArrowLeftIcon, CalendarIcon, DeleteIcon, XIcon, ZapIcon } from 'lucide-react';
import { PaycheckOverrideScope, useBudget } from '../contexts/BudgetContext';
import { Transaction } from '../types/budget';
import { formatCurrency, parseAmount, sanitizeAmountInput, toAmountInput } from '../utils/format';

interface PaycheckEntrySheetProps {
  open: boolean;
  onClose: () => void;
  /** The generated payroll entry being corrected. */
  transaction?: Transaction | null;
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/**
 * Correcting one generated payroll entry — the paycheck that came in different
 * from what the deduction said.
 *
 * Deliberately not EntrySheet. A payroll entry has no description to write and
 * no date to move (the pay date is the pay date), only an amount and which
 * Savings bucket it lands in. What it has instead is the question EntrySheet
 * never asks: does this correction apply to this paycheck or to every one
 * after it. That choice is a second step rather than a checkbox, because the
 * two answers lead somewhere genuinely different — one touches a single row,
 * the other rewrites the deduction and your net pay from here on.
 */
export function PaycheckEntrySheet({ open, onClose, transaction = null }: PaycheckEntrySheetProps) {
  const { activeCategories, categories, incomeSources, overridePaycheckEntry } = useBudget();

  const [step, setStep] = useState<'edit' | 'scope'>('edit');
  const [rawAmount, setRawAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState<PaycheckOverrideScope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('edit');
    setRawAmount(transaction ? toAmountInput(transaction.amount) : '');
    setCategoryId(transaction?.categoryId ?? null);
    setSaving(null);
    setError(null);
  }, [open, transaction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Payroll savings only ever land in a Savings bucket — that is the invariant
  // generate_paycheck_entries() is built on, and override_paycheck_entry()
  // re-checks it server-side. An archived one stays pickable while it is the
  // bucket this entry already uses.
  const options = useMemo(() => {
    const list = activeCategories.filter((c) => c.parent === 'Savings');
    const current = categories.find((c) => c.id === transaction?.categoryId);
    if (current && current.archived && !list.some((c) => c.id === current.id)) list.push(current);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategories, categories, transaction]);

  // What the deduction holds right now, which is what every later payday is
  // still generated from — the real "unless you change it" number.
  const deduction = useMemo(() => {
    if (!transaction?.incomeDeductionId) return null;
    for (const source of incomeSources) {
      const found = [...source.preTax, ...source.postTax].find(
        (d) => d.id === transaction.incomeDeductionId
      );
      if (found) return { ...found, sourceName: source.name };
    }
    return null;
  }, [incomeSources, transaction]);

  const amount = parseAmount(rawAmount);
  const changed =
  Boolean(transaction) && (
  amount !== transaction?.amount || categoryId !== transaction?.categoryId);
  const canSave = amount > 0 && Boolean(categoryId) && changed;

  const missing = !canSave ?
  amount <= 0 ?
  'Enter an amount' :
  !categoryId ?
  'Pick a Savings category' :
  'Change the amount or category' :
  null;

  const press = (key: string) => {
    if (key === 'del') {
      setRawAmount((value) => value.slice(0, -1));
      return;
    }
    if (key === '.') {
      setRawAmount((value) => value.includes('.') ? value : `${value || '0'}.`);
      return;
    }
    setRawAmount((value) => sanitizeAmountInput(value + key));
  };

  const commit = async (scope: PaycheckOverrideScope) => {
    if (!transaction || !categoryId || amount <= 0) return;
    setSaving(scope);
    setError(null);
    try {
      await overridePaycheckEntry(transaction.id, { amount, categoryId }, scope);
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ?
        err.message :
        'That change did not save. Check your connection and try again.'
      );
      setSaving(null);
    }
  };

  const payDate = transaction ? format(parseISO(transaction.date), 'EEE, MMM d, yyyy') : '';
  // An orphaned entry (its deduction was deleted) has no future to carry
  // anything into, so the question only has one honest answer.
  const canCarryForward = Boolean(transaction?.incomeDeductionId);

  return (
    <AnimatePresence>
      {open && transaction &&
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>

          <div
          className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true" />

          <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Edit paycheck entry"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line bg-surface sm:max-h-[min(44rem,92vh)] sm:rounded-2xl">

            <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                {step === 'scope' &&
              <button
                type="button"
                onClick={() => setStep('edit')}
                aria-label="Back to the amount"
                className="-ml-1 rounded-full p-1 text-subtle transition-colors hover:bg-canvas hover:text-ink">

                    <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
              }
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  {step === 'edit' ? 'Edit paycheck entry' : 'Apply this change to'}
                </span>
              </div>
              <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">

                <XIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            {step === 'edit' ?
          <>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
                  <div className="rounded-control border border-line bg-canvas px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                      <ZapIcon className="h-2.5 w-2.5" aria-hidden="true" />
                      Auto · from paycheck
                    </p>
                    <p className="mt-1 truncate text-[13px] font-medium text-ink">
                      {transaction.description}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                      <CalendarIcon className="h-3 w-3" aria-hidden="true" />
                      {payDate}
                    </p>
                  </div>

                  <div className="mt-3">
                    <label
                  htmlFor="paycheck-amount"
                  className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">

                      What actually came off this paycheck
                    </label>
                    <div
                  className={`flex items-baseline text-[40px] font-bold leading-none tracking-[-0.04em] transition-colors ${
                  amount > 0 ? 'text-ink' : 'text-subtle'}`
                  }>

                      <span aria-hidden="true">$</span>
                      <input
                    id="paycheck-amount"
                    ref={amountRef}
                    type="text"
                    inputMode="none"
                    autoComplete="off"
                    value={rawAmount}
                    onChange={(e) => setRawAmount(sanitizeAmountInput(e.target.value))}
                    onBlur={() =>
                    setRawAmount((value) => value.endsWith('.') ? value.slice(0, -1) : value)
                    }
                    placeholder="0"
                    aria-label="Amount in dollars"
                    className="tabular w-full min-w-0 bg-transparent p-0 outline-none placeholder:text-subtle" />

                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">
                      Generated at {formatCurrency(transaction.amount)}
                      {deduction && deduction.amount !== transaction.amount &&
                  <> · deduction now says {formatCurrency(deduction.amount)}</>
                  }
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                      Lands in
                    </p>
                    <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
                      {options.map((c) => {
                    const active = categoryId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryId(c.id)}
                        aria-pressed={active}
                        className={`h-8 shrink-0 rounded-full border px-3 text-[13px] transition-colors ${
                        active ?
                        'border-ink bg-ink font-medium text-white' :
                        'border-line bg-surface text-muted hover:text-ink'}`
                        }>

                            {c.name}
                            {c.archived && ' (archived)'}
                          </button>);

                  })}
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] leading-relaxed text-subtle">
                    The pay date and the label come from your paycheck, so they stay put. Earlier
                    paychecks are never touched.
                  </p>

                  {error &&
              <p className="mt-3 rounded-control bg-alert/8 px-3 py-2 text-[11px] leading-relaxed text-alert">
                      {error}
                    </p>
              }
                </div>

                <div
              className="shrink-0 border-t border-line bg-canvas px-3 pb-3 pt-2"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>

                  <div className="grid grid-cols-3 gap-1.5 pb-2">
                    {keys.map((key) =>
                <button
                  key={key}
                  type="button"
                  onClick={() => press(key)}
                  aria-label={key === 'del' ? 'Delete last digit' : key}
                  className="flex h-12 items-center justify-center rounded-control border border-line bg-surface text-xl font-semibold tracking-[-0.02em] text-ink transition-colors active:bg-line">

                        {key === 'del' ?
                  <DeleteIcon className="h-5 w-5" aria-hidden="true" /> :

                  key
                  }
                      </button>
                )}
                  </div>

                  <button
                type="button"
                onClick={() => canCarryForward ? setStep('scope') : commit('this')}
                disabled={!canSave || saving !== null}
                className="h-12 w-full rounded-control bg-primary text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:bg-line disabled:text-subtle">

                    {saving ? 'Saving…' : missing ?? 'Save change'}
                  </button>
                </div>
              </> :

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
                <p className="text-[13px] leading-relaxed text-muted">
                  {formatCurrency(transaction.amount)} → {formatCurrency(amount)} on{' '}
                  {format(parseISO(transaction.date), 'MMM d')}.
                </p>

                <div className="mt-3 space-y-2">
                  <ScopeOption
                onClick={() => commit('this')}
                busy={saving === 'this'}
                disabled={saving !== null}
                title="Just this paycheck"
                detail={
                deduction ?
                `Only ${format(parseISO(transaction.date), 'MMM d')} changes. Every later payday keeps generating at ${formatCurrency(deduction.amount)}.` :
                `Only ${format(parseISO(transaction.date), 'MMM d')} changes.`
                }
                primary />

                  <ScopeOption
                onClick={() => commit('future')}
                busy={saving === 'future'}
                disabled={saving !== null}
                title="This and all future paychecks"
                detail={`Updates the deduction in Settings › Income to ${formatCurrency(amount)}, so every payday after this one is generated at the new amount — and your take-home changes to match. Paychecks before this one stay as they are.`} />

                </div>

                {error &&
            <p className="mt-3 rounded-control bg-alert/8 px-3 py-2 text-[11px] leading-relaxed text-alert">
                    {error}
                  </p>
            }
              </div>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}

function ScopeOption({
  onClick,
  title,
  detail,
  busy,
  disabled,
  primary = false








}: {onClick: () => void;title: string;detail: string;busy: boolean;disabled: boolean;primary?: boolean;}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-card border px-3.5 py-3 text-left transition-colors disabled:opacity-60 ${
      primary ?
      'border-ink/20 bg-canvas hover:border-ink' :
      'border-line bg-surface hover:border-ink/40'}`
      }>

      <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {busy ? 'Saving…' : title}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-subtle">{detail}</p>
    </button>);

}
