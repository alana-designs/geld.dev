import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LoaderIcon, LogOutIcon, UserMinusIcon, XIcon } from 'lucide-react';
import { Member } from '../types/budget';

export type MembershipAction =
{kind: 'leave';householdName: string;entryCount: number;} |
{kind: 'remove';member: Member;entryCount: number;};

interface Props {
  action: MembershipAction | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Both exits, which are the same operation from two directions: the departing
 * member and their rows move to a household of their own. Nothing is deleted,
 * and the copy says so — the fear this modal has to answer is "will I lose my
 * history", and the honest answer is no.
 */
export function MembershipConfirmModal({ action, onClose, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (action) {
      setBusy(false);
      setError(null);
    }
  }, [action]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    if (action) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, busy, onClose]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
      setBusy(false);
    }
  };

  const leaving = action?.kind === 'leave';
  const who = action?.kind === 'remove' ? action.member.name : '';
  const title = leaving ?
  `Leave ${(action as {householdName: string;}).householdName}?` :
  `Remove ${who}?`;
  const cta = leaving ? 'Leave household' : `Remove ${who}`;

  return (
    <AnimatePresence>
      {action &&
      <motion.div
        className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}>

          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => !busy && onClose()} aria-hidden="true" />

          <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="membership-title"
          initial={{ y: 32, opacity: 0, scale: 0.99 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-6 sm:rounded-2xl"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>

            <button
            type="button"
            onClick={() => !busy && onClose()}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">

              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-alert/10 text-alert">
              {leaving ?
            <LogOutIcon className="h-5 w-5" aria-hidden="true" /> :
            <UserMinusIcon className="h-5 w-5" aria-hidden="true" />
            }
            </div>

            <h2 id="membership-title" className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {leaving ?
            <>You&rsquo;ll go back to a household of your own. Your history isn&rsquo;t deleted &mdash; it comes with you.</> :
            <>They keep everything they logged &mdash; it moves to a household of their own. Nothing of yours is deleted.</>
            }
            </p>

            {action.kind === 'remove' &&
          <div className="mt-4 flex items-center gap-3 rounded-control border border-line px-3.5 py-3">
                <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: action.member.color }}
              aria-hidden="true">

                  {action.member.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{action.member.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {action.member.email} &middot; {plural(action.entryCount, 'entry').replace('entrys', 'entries')}
                  </span>
                </span>
              </div>
          }

            <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
              {leaving ?
            <>
                  <li>
                    <span className="font-medium text-ink">
                      {action.entryCount === 1 ? '1 entry' : `${action.entryCount} entries`}
                    </span>
                    , your categories and your income move out with you.
                  </li>
                  <li>They stop seeing your spending and paycheck details immediately.</li>
                  <li>You lose the shared view of theirs, and the household totals on your dashboard.</li>
                  <li>Getting back in needs a fresh invite, confirmed the same way.</li>
                </> :

            <>
                  <li>{who} stops seeing your entries and paycheck details right away.</li>
                  <li>
                    Their{' '}
                    <span className="font-medium text-ink">
                      {action.entryCount === 1 ? '1 entry' : `${action.entryCount} entries`}
                    </span>{' '}
                    leave your household totals, including past months.
                  </li>
                  <li>They aren&rsquo;t notified. Their app simply shows their own household again.</li>
                </>
            }
            </ul>

            {error && <p className="mt-3 text-xs text-alert">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-control border border-line py-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-60">

                {leaving ? 'Stay' : 'Cancel'}
              </button>
              <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-control bg-alert py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60">

                {busy && <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {cta}
              </button>
            </div>
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}
