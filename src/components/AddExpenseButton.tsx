import React from 'react';
import { PlusIcon } from 'lucide-react';

interface AddExpenseButtonProps {
  onClick: () => void;
}

/**
 * Desktop-only primary action. On mobile the same action lives in the
 * thumb-reachable button on the bottom nav, so this stays hidden there.
 */
export function AddExpenseButton({ onClick }: AddExpenseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-9 shrink-0 items-center gap-1.5 rounded-control bg-primary px-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] lg:inline-flex">

      <PlusIcon className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
      Add expense
    </button>);

}
