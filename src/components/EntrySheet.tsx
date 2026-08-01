import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, CheckIcon, DeleteIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBudget } from '../contexts/BudgetContext';
import { PARENT_CATEGORIES, PARENT_STYLES, ParentCategory, Transaction } from '../types/budget';
import { parseAmount, sanitizeAmountInput, toAmountInput } from '../utils/format';

interface EntrySheetProps {
  open: boolean;
  onClose: () => void;
  /** Pass a transaction to edit it; omit to create a new one. */
  transaction?: Transaction | null;
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
const today = () => format(new Date(), 'yyyy-MM-dd');

export function EntrySheet({ open, onClose, transaction = null }: EntrySheetProps) {
  const {
    categories,
    activeCategories,
    usage,
    addCategory,
    addTransaction,
    updateTransaction,
    deleteTransaction
  } = useBudget();

  const editing = Boolean(transaction);

  const [rawAmount, setRawAmount] = useState('');
  const [parent, setParent] = useState<ParentCategory>('Needs');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<'amount' | 'text'>('amount');
  const [dateOpen, setDateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // Kept in a ref so adding a category mid-flow never resets the form.
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      const existing = categoriesRef.current.find((c) => c.id === transaction.categoryId);
      setRawAmount(toAmountInput(transaction.amount));
      setParent(existing?.parent ?? 'Needs');
      setCategoryId(transaction.categoryId);
      setDescription(transaction.description);
      setDate(transaction.date);
      setMode('text');
    } else {
      setRawAmount('');
      setParent('Needs');
      setCategoryId(null);
      setDescription('');
      setDate(today());
      setMode('amount');
    }
    setDateOpen(false);
    setCreating(false);
    setNewName('');
    setConfirmDelete(false);
  }, [open, transaction]);

  // New entries land on the amount so a keyboard can start typing immediately.
  useEffect(() => {
    if (!open || transaction) return;
    const t = setTimeout(() => amountRef.current?.focus(), 240);
    return () => clearTimeout(t);
  }, [open, transaction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // The Budget section is the single source of truth for what you can pick here.
  // An archived category stays selectable while editing the entry that still uses it.
  const options = useMemo(() => {
    const list = activeCategories.filter((c) => c.parent === parent);
    const current = categories.find((c) => c.id === transaction?.categoryId);
    if (current && current.archived && current.parent === parent) list.push(current);
    return list.sort(
      (a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name)
    );
  }, [activeCategories, categories, parent, usage, transaction]);

  const amount = parseAmount(rawAmount);
  const selected = options.find((c) => c.id === categoryId);
  const canSave = amount > 0 && Boolean(selected) && description.trim().length > 0;

  const missing = !canSave ?
  amount <= 0 ?
  'Enter an amount' :
  !selected ?
  'Pick a category' :
  'Add a short description' :
  null;

  const press = (key: string) => {
    setMode('amount');
    if (key === 'del') {
      setRawAmount((value) => value.slice(0, -1));
      return;
    }
    if (key === '.') {
      // The decimal is always deliberate — "17" means $17, never $0.17.
      setRawAmount((value) => value.includes('.') ? value : `${value || '0'}.`);
      return;
    }
    setRawAmount((value) => sanitizeAmountInput(value + key));
  };

  const save = () => {
    if (!canSave || !categoryId) return;
    const payload = { amount, categoryId, description: description.trim(), date };
    if (transaction) updateTransaction(transaction.id, payload);else
    addTransaction(payload);
    onClose();
  };

  const remove = () => {
    if (!transaction) return;
    deleteTransaction(transaction.id);
    onClose();
  };

  const quickAdd = () => {
    if (!newName.trim()) return;
    const created = addCategory(newName, parent);
    setCategoryId(created.id);
    setNewName('');
    setCreating(false);
    setMode('text');
    setTimeout(() => descriptionRef.current?.focus(), 50);
  };

  const dateLabel =
  date === today() ? 'Today' : format(parseISO(date), 'EEE, MMM d');

  return (
    <AnimatePresence>
      {open &&
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
          aria-label={editing ? 'Edit entry' : 'Add expense'}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          className="relative flex h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-line bg-surface sm:h-[min(44rem,92vh)] sm:rounded-2xl">
          
            <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                {editing ? 'Edit entry' : 'New entry'}
              </span>
              <div className="flex items-center gap-1">
                {editing &&
              <button
                type="button"
                onClick={() => confirmDelete ? remove() : setConfirmDelete(true)}
                onBlur={() => setConfirmDelete(false)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
                confirmDelete ?
                'bg-alert text-white' :
                'text-alert hover:bg-alert/5'}`
                }>
                
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {confirmDelete ? 'Tap to confirm' : 'Delete'}
                  </button>
              }
                <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">
                
                  <XIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Everything lives on one screen — the body scrolls, the keypad never moves. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label
                  htmlFor="entry-amount"
                  className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                  
                    Amount
                  </label>
                  <div
                  className={`flex items-baseline text-[40px] font-bold leading-none tracking-[-0.04em] transition-colors ${
                  amount > 0 ? 'text-ink' : 'text-subtle'}`
                  }>
                  
                    <span aria-hidden="true">$</span>
                    <input
                    id="entry-amount"
                    ref={amountRef}
                    type="text"
                    // Lets a physical keyboard type freely while keeping the
                    // OS keypad from fighting the custom one on mobile.
                    inputMode="none"
                    autoComplete="off"
                    value={rawAmount}
                    onChange={(e) => setRawAmount(sanitizeAmountInput(e.target.value))}
                    onFocus={() => setMode('amount')}
                    onBlur={() =>
                    setRawAmount((value) => value.endsWith('.') ? value.slice(0, -1) : value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        descriptionRef.current?.focus();
                      }
                    }}
                    placeholder="0"
                    aria-label="Amount in dollars"
                    className="tabular w-full min-w-0 bg-transparent p-0 outline-none placeholder:text-subtle" />
                  
                  </div>
                </div>

                <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                aria-expanded={dateOpen}
                className={`mt-3 flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                date === today() ?
                'border-line bg-canvas text-muted' :
                'border-wants/30 bg-wants/8 text-wants'}`
                }>
                
                  <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {dateLabel}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {dateOpen &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                
                    <div className="mt-2.5 rounded-control border border-line bg-canvas p-2.5">
                      <input
                    type="date"
                    value={date}
                    max={today()}
                    onChange={(e) => setDate(e.target.value || today())}
                    aria-label="Entry date"
                    className="w-full rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink" />
                  
                      <div className="mt-2 flex gap-1.5">
                        {[0, 1, 2].map((offset) => {
                      const value = format(
                        new Date(Date.now() - offset * 86400000),
                        'yyyy-MM-dd'
                      );
                      const label =
                      offset === 0 ?
                      'Today' :
                      offset === 1 ?
                      'Yesterday' :
                      format(parseISO(value), 'EEE');
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDate(value)}
                          aria-pressed={date === value}
                          className={`h-8 flex-1 rounded-full border text-xs font-medium transition-colors ${
                          date === value ?
                          'border-ink bg-ink text-white' :
                          'border-line bg-surface text-muted hover:text-ink'}`
                          }>
                          
                              {label}
                            </button>);

                    })}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-subtle">
                        Back-dating moves the entry into that month&rsquo;s totals.
                      </p>
                    </div>
                  </motion.div>
              }
              </AnimatePresence>

              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {PARENT_CATEGORIES.map((p) => {
                const active = parent === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setParent(p);
                      setCategoryId(null);
                      setCreating(false);
                    }}
                    aria-pressed={active}
                    className={`h-9 rounded-full text-[13px] font-semibold transition-colors ${
                    active ? 'text-white' : 'bg-canvas text-muted hover:text-ink'}`
                    }
                    style={active ? { backgroundColor: PARENT_STYLES[p].hex } : undefined}>
                    
                      {p}
                    </button>);

              })}
              </div>

              <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
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

                {creating ?
              <div className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-ink bg-surface pl-3 pr-1">
                    <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
                  placeholder={`New ${parent} category`}
                  aria-label="New category name"
                  className="w-36 bg-transparent text-[13px] text-ink outline-none placeholder:text-subtle" />
                
                    <button
                  type="button"
                  onClick={quickAdd}
                  aria-label="Create category"
                  className="rounded-full bg-ink p-1 text-white">
                  
                      <CheckIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div> :

              <button
                type="button"
                onClick={() => setCreating(true)}
                aria-label="New category"
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-subtle transition-colors hover:border-ink/40 hover:text-ink">
                
                    <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    New
                  </button>
              }
              </div>

              {options.length === 0 && !creating &&
            <p className="mt-2 text-[11px] leading-relaxed text-subtle">
                  No {parent} categories yet — add one here, or set them up in{' '}
                  <Link to="/budget" className="font-medium text-primary underline">
                    Budget
                  </Link>
                  .
                </p>
            }

              <div className="mt-3">
                <label htmlFor="entry-description" className="sr-only">
                  What was it?
                </label>
                <input
                id="entry-description"
                ref={descriptionRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setMode('text')}
                placeholder="What was it? e.g. Farmers market produce"
                className="w-full rounded-control border border-line bg-surface px-3 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink" />
              
              </div>
            </div>

            <div
            className="shrink-0 border-t border-line bg-canvas px-3 pb-3 pt-2"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            
              <AnimatePresence initial={false}>
                {mode === 'amount' &&
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden">
                
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
                  </motion.div>
              }
              </AnimatePresence>

              <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="h-12 w-full rounded-control bg-primary text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:bg-line disabled:text-subtle">
              
                {missing ?? (editing ? 'Save changes' : 'Save entry')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}