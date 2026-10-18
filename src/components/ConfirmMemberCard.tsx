import React, { useState } from 'react';
import { LoaderIcon, UserCheckIcon } from 'lucide-react';
import { PendingConfirmation, useBudget } from '../contexts/BudgetContext';

/**
 * The inviter's half of the handshake, and the only place a mistyped invite is
 * caught.
 *
 * Leads with the email address rather than the name on purpose: the name is
 * whatever the accepter set on their own profile, so it can be made to look
 * like anyone. The address is the thing the inviter actually typed, and the
 * only field worth checking.
 */
export function ConfirmMemberCard({ request }: {request: PendingConfirmation;}) {
  const { confirmMember, rejectMember } = useBudget();
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: 'confirm' | 'reject') => {
    setBusy(action);
    setError(null);
    try {
      if (action === 'confirm') await confirmMember(request.id);
      else await rejectMember(request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — try again.');
      setBusy(null);
    }
  };

  // They accepted at a different address than the one that was typed — only
  // possible via a redirected or forwarded mailbox, and worth calling out.
  const addressDiffers =
  request.acceptedEmail.trim().toLowerCase() !== request.invitedEmail.trim().toLowerCase();

  return (
    <section className="overflow-hidden rounded-card border border-wants/40 bg-surface">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wants/10 text-wants">
            <UserCheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-ink">
            Someone accepted your invite
          </h2>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Check this is who you meant to invite. Nothing has been shared yet.
        </p>
      </div>

      <div className="px-4 py-3">
        <div className="rounded-control border border-wants/50 bg-wants/[0.04] p-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: '#8a5f7e' }}
              aria-hidden="true">

              {request.acceptedName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">
                {request.acceptedName}
              </span>
              <span className="block break-all text-sm font-medium text-ink">
                {request.acceptedEmail}
              </span>
            </span>
          </div>
          <p className="mt-2.5 border-t border-wants/25 pt-2.5 text-[11px] leading-relaxed text-muted">
            Read the address, not the name &mdash; they chose the name themselves. If it isn&rsquo;t
            exactly who you invited, decline.
          </p>
        </div>

        {addressDiffers &&
        <p className="mt-2.5 text-[11px] leading-relaxed text-alert">
            Heads up: you invited <span className="font-medium">{request.invitedEmail}</span>, but
            they accepted as <span className="font-medium">{request.acceptedEmail}</span>.
          </p>
        }

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Confirming shares your entries, categories and{' '}
          <span className="font-medium text-ink">paycheck details</span> with them, and theirs with
          you.
        </p>

        {error && <p className="mt-2.5 text-[11px] text-alert">{error}</p>}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => run('reject')}
            disabled={busy !== null}
            className="flex-1 rounded-control border border-line py-2.5 text-xs font-semibold text-alert transition-colors hover:bg-canvas disabled:opacity-60">

            {busy === 'reject' ? 'Declining…' : "That's not them"}
          </button>
          <button
            type="button"
            onClick={() => run('confirm')}
            disabled={busy !== null}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-primary py-2.5 text-xs font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60">

            {busy === 'confirm' && <LoaderIcon className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Confirm and share
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-subtle">
          Declining cancels the invite. They&rsquo;re never told who you are.
        </p>
      </div>
    </section>);

}
