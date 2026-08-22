import React, { useEffect, useState } from 'react';
import { ClockIcon, LoaderIcon, LogOutIcon, UsersIcon } from 'lucide-react';
import { IncomingInvite, useBudget } from '../contexts/BudgetContext';

/** Whole minutes left, floored, never negative. */
function minutesLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

/**
 * Shown to someone who's been invited into a household they aren't in yet.
 *
 * Accepting here shares nothing on its own — the inviter still has to confirm
 * the address that accepted. That's what makes a mistyped invite safe: a
 * stranger who claims it gets stopped at the inviter's confirmation, having
 * seen none of the household's data.
 */
export function IncomingInviteCard({ invite }: {invite: IncomingInvite;}) {
  const { acceptInvite, declineInvite } = useBudget();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(() => minutesLeft(invite.expiresAt));

  useEffect(() => {
    const t = setInterval(() => setLeft(minutesLeft(invite.expiresAt)), 30_000);
    return () => clearInterval(t);
  }, [invite.expiresAt]);

  const run = async (action: 'accept' | 'decline') => {
    setBusy(action);
    setError(null);
    try {
      if (action === 'accept') await acceptInvite(invite.id);
      else await declineInvite(invite.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
      setBusy(null);
    }
  };

  const others = Math.max(invite.householdSize, 1);
  const expired = left <= 0;

  return (
    <section className="overflow-hidden rounded-card border border-wants/40 bg-surface">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wants/10 text-wants">
            <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em] text-ink">
            Join {invite.inviterName}&rsquo;s household?
          </h2>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-wants/10 px-2 py-1 text-[11px] font-semibold text-wants">
            <ClockIcon className="h-3 w-3" aria-hidden="true" />
            {expired ? 'Expired' : `${left} min`}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">{invite.inviterEmail}</span> invited you to share a
          household{others > 1 ? ` with ${others} people already in it` : ''}.
        </p>
      </div>

      <div className="px-4 py-3">
        {expired ?
        <p className="text-[11px] leading-relaxed text-muted">
            This invite has run out. Ask {invite.inviterName} to send a new one &mdash; nothing was
            shared.
          </p> :

        <>
            <p className="text-[11px] font-medium text-ink">If you join</p>
            <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted">
              <li>
                Your entries, categories and income move into that household &mdash; everyone in it
                can see them, including your paycheck details.
              </li>
              <li>You&rsquo;ll see theirs the same way. Only you can edit your own.</li>
              <li>
                <span className="inline-flex items-center gap-1 align-[-2px]">
                  <LogOutIcon className="h-3 w-3" aria-hidden="true" />
                </span>{' '}
                You can leave later from Settings, and your entries come back out with you.
              </li>
            </ul>

            {error && <p className="mt-2.5 text-[11px] text-alert">{error}</p>}

            <div className="mt-3 flex gap-2">
              <button
              type="button"
              onClick={() => run('decline')}
              disabled={busy !== null}
              className="flex-1 rounded-control border border-line py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-60">

                {busy === 'decline' ? 'Declining…' : 'No thanks'}
              </button>
              <button
              type="button"
              onClick={() => run('accept')}
              disabled={busy !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-primary py-2.5 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60">

                {busy === 'accept' && <LoaderIcon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Join household
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-subtle">
              Accepting doesn&rsquo;t share anything on its own &mdash; {invite.inviterName} has to
              confirm it&rsquo;s you first.
            </p>
          </>
        }
      </div>
    </section>);

}
