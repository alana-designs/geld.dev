import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { PencilIcon, RepeatIcon, Trash2Icon, ZapIcon } from 'lucide-react';
import { Category, Member, Transaction } from '../types/budget';
import { formatCurrency } from '../utils/format';
import { ParentBadge } from './ParentBadge';

interface EntryRowProps {
  transaction: Transaction;
  category?: Category;
  /** Shown only in the combined household view. */
  member?: Member;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
}

export function EntryRow({ transaction, category, member, onEdit, onDelete }: EntryRowProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A payroll entry is a real row with a deduction behind it, which is exactly
  // what delete_paycheck_entry() needs to write its skip — so that id is what
  // decides whether the delete is offered. A recurring entry is a projection
  // with no row at all; the only way to stop one is to edit the expense.
  const payrollAuto = transaction.auto && Boolean(transaction.incomeDeductionId);

  const toggle = () => {
    setOpen((v) => !v);
    setConfirmDelete(false);
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-line last:border-b-0">
      
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-canvas">
        
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight tracking-[-0.01em] text-ink">
            {transaction.description}
          </p>
          <div className="mt-1 flex items-center gap-2">
            {category && <ParentBadge parent={category.parent} />}
            <span className="truncate text-xs text-muted">{category?.name ?? 'Uncategorized'}</span>
            {member &&
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted">
                <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: member.color }}
                aria-hidden="true" />
              
                {member.isSelf ? 'You' : member.name}
              </span>
            }
            {transaction.auto &&
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-subtle">
                <ZapIcon className="h-2.5 w-2.5" aria-hidden="true" />
                {transaction.autoSource === 'recurring' ? 'Auto · from Expense' : 'Auto · from paycheck'}
              </span>
            }
            {transaction.recurring && !transaction.auto &&
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-subtle">
                <RepeatIcon className="h-2.5 w-2.5" aria-hidden="true" />
                Repeats monthly
              </span>
            }
          </div>
        </div>
        <span className="tabular shrink-0 text-[15px] font-semibold tracking-[-0.02em] text-ink">
          {formatCurrency(transaction.amount)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden">
          
            <div className="flex flex-col gap-3 bg-canvas px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-[13px] leading-relaxed text-ink/80">{transaction.description}</p>
                <p className="mt-1 text-xs text-subtle">
                  {format(parseISO(transaction.date), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                {transaction.auto &&
              <p className="text-[11px] leading-relaxed text-subtle sm:max-w-[13rem] sm:text-right">
                    {transaction.autoSource === 'recurring' ?
                'Generated from a recurring expense. Edit the original entry to change it.' :
                'Generated from a tagged paystub deduction. Edit it in Settings › Income. Deleting removes this paycheck only — your income settings stay as they are.'}
                  </p>
              }
                <div className="flex items-center gap-1.5">
                {!transaction.auto && onEdit &&
              <button
                type="button"
                onClick={() => onEdit(transaction)}
                className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-canvas">
                
                    <PencilIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </button>
              }
                {!transaction.auto && onDelete &&
              <button
                type="button"
                onClick={() => onDelete(transaction.id)}
                aria-label="Delete entry"
                className="flex items-center rounded-control border border-line bg-surface p-1.5 text-alert transition-colors hover:bg-alert/5">
                
                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
              }
                {payrollAuto && onDelete &&
              <button
                type="button"
                onClick={() => confirmDelete ? onDelete(transaction.id) : setConfirmDelete(true)}
                onBlur={() => setConfirmDelete(false)}
                className={`flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                confirmDelete ?
                'border-alert bg-alert text-white' :
                'border-line bg-surface text-alert hover:bg-alert/5'}`
                }>

                    <Trash2Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {confirmDelete ? 'Tap to confirm' : 'Delete this one'}
                  </button>
              }
                </div>
              </div>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.li>);

}