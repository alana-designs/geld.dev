import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { monthLabel, shortMonthLabel } from '../utils/rollups';

interface MonthPickerProps {
  months: string[];
  value: string;
  onChange: (key: string) => void;
}

/** months is newest-first; you can only go back as far as there is data. */
export function MonthPicker({ months, value, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const index = months.indexOf(value);
  const canGoBack = index < months.length - 1;
  const canGoForward = index > 0;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => canGoBack && onChange(months[index + 1])}
        disabled={!canGoBack}
        aria-label="Previous month"
        className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-muted transition-colors hover:text-ink disabled:opacity-30">
        
        <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink">
        
        {shortMonthLabel(value)}
        <ChevronDownIcon className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => canGoForward && onChange(months[index - 1])}
        disabled={!canGoForward}
        aria-label="Next month"
        className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-muted transition-colors hover:text-ink disabled:opacity-30">
        
        <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open &&
        <motion.ul
          role="listbox"
          aria-label="Select month"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 top-11 z-40 max-h-64 w-52 overflow-y-auto rounded-card border border-line bg-surface py-1 shadow-lg">
          
            {months.map((key) =>
          <li key={key}>
                <button
              type="button"
              role="option"
              aria-selected={key === value}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-canvas ${
              key === value ? 'font-semibold text-ink' : 'text-muted'}`
              }>
              
                  {monthLabel(key)}
                  {key === value &&
              <CheckIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              }
                </button>
              </li>
          )}
            <li className="border-t border-line px-3 py-2 text-[11px] leading-relaxed text-subtle">
              History starts the month of your first entry.
            </li>
          </motion.ul>
        }
      </AnimatePresence>
    </div>);

}