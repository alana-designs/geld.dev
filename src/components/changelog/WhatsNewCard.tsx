import React from 'react';
import { ArrowUpRightIcon, SparklesIcon } from 'lucide-react';
import { latestRelease } from '../../data/changelog';

interface WhatsNewCardProps {
  onOpen: () => void;
  unread: boolean;
}

/** Sits at the foot of the desktop rail; the mobile path is Settings. */
export function WhatsNewCard({ onOpen, unread }: WhatsNewCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden rounded-card border border-line bg-canvas text-left transition-colors hover:border-subtle/50">

      {latestRelease?.image ?
      <span className="block aspect-[16/9] w-full overflow-hidden border-b border-line bg-surface">
          <img src={latestRelease.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </span> :

      <span className="flex aspect-[16/9] w-full items-center justify-center border-b border-line bg-surface text-subtle">
          <SparklesIcon className="h-5 w-5" aria-hidden="true" />
        </span>
      }

      <span className="block p-3">
        <span className="flex items-center gap-1.5">
          {unread &&
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-wants" aria-hidden="true" />
          }
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
            New in Geld
          </span>
        </span>

        <span className="mt-1 flex items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {latestRelease?.title ?? 'Nothing published yet'}
          </span>
          <ArrowUpRightIcon
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle transition-colors group-hover:text-ink"
            aria-hidden="true" />

        </span>

        {/* Clamped to two lines so a long summary can't push the rail's other
            content off-screen — the full text is one click away in the modal.
            No `block` here: line-clamp sets its own display, and the two
            utilities would otherwise race on source order. */}
        <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">
          {latestRelease?.summary ?? 'Check back as new features ship.'}
        </span>
      </span>
    </button>);

}
