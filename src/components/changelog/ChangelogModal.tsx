import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { CheckIcon, SparklesIcon, XIcon } from 'lucide-react';
import { markChangelogSeen, releases } from '../../data/changelog';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

/** Every published release, newest first. */
export function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  useEffect(() => {
    if (open) markChangelogSeen();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open &&
      <motion.div
        className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
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
          aria-labelledby="changelog-title"
          initial={{ y: '4%', opacity: 0, scale: 0.99 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: '2%', opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-canvas sm:h-[min(42rem,88vh)] sm:rounded-2xl">

          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
                Changelog
              </p>
              <h2 id="changelog-title" className="text-xl font-bold tracking-[-0.03em] text-ink">
                New in Geld
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Everything shipped so far, newest first.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">

              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {releases.length === 0 ?
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-subtle">
                  <SparklesIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-ink">Nothing published yet</p>
                <p className="max-w-xs text-xs leading-relaxed text-muted">
                  Releases will show up here as they ship.
                </p>
              </div> :

            releases.map((release, index) =>
            <article
              key={release.id}
              className="overflow-hidden rounded-card border border-line bg-surface">

                  {release.image &&
              <div className="aspect-[16/9] w-full overflow-hidden border-b border-line bg-canvas">
                      <img
                  src={release.image}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy" />

                    </div>
              }

                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tabular rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        v{release.version}
                      </span>
                      <span className="text-[11px] text-subtle">
                        {format(parseISO(release.date), 'MMMM d, yyyy')}
                      </span>
                      {index === 0 &&
                  <span className="rounded-md bg-wants/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-wants">
                          Latest
                        </span>
                  }
                    </div>

                    <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-ink">
                      {release.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {release.summary}
                    </p>

                    <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                      {release.items.map((item) =>
                  <li key={item} className="flex items-start gap-2">
                          <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-needs" aria-hidden="true" />
                          <span className="text-[13px] leading-relaxed text-ink/80">{item}</span>
                        </li>
                  )}
                    </ul>
                  </div>
                </article>
            )
            }

            {releases.length > 0 &&
            <p className="px-1 pb-1 text-center text-[11px] leading-relaxed text-subtle">
                Published with every deployment.
              </p>
            }
          </div>
        </motion.div>
      </motion.div>
      }
    </AnimatePresence>);

}
