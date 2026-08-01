import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon, CheckIcon, LoaderIcon, LogOutIcon, MailIcon, XIcon } from 'lucide-react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSendMagicLink: (email: string) => Promise<{ error: string | null }>;
  signedInEmail?: string | null;
  onSignOut?: () => void;
}

type Stage = 'email' | 'sending' | 'sent';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthModal({
  open,
  onClose,
  onSendMagicLink,
  signedInEmail,
  onSignOut
}: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('email');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStage('email');
        setError(null);
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPattern.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setStage('sending');
    const { error: sendError } = await onSendMagicLink(email.trim());
    if (sendError) {
      setError(sendError);
      setStage('email');
      return;
    }
    setStage('sent');
  };

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
          aria-labelledby="auth-title"
          initial={{ y: 32, opacity: 0, scale: 0.99 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md rounded-t-2xl border border-line bg-surface p-6 sm:rounded-2xl"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          
            <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-subtle transition-colors hover:bg-canvas hover:text-ink">
            
              <XIcon className="h-4 w-4" aria-hidden="true" />
            </button>

            {signedInEmail ?
          <div className="pt-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink">
                  <MailIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="auth-title" className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
                  Signed in
                </h2>
                <p className="mt-1.5 text-sm text-muted">
                  Your ledger is tied to{' '}
                  <span className="font-medium text-ink">{signedInEmail}</span>.
                </p>
                <button
              type="button"
              onClick={() => {
                onSignOut?.();
                onClose();
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-control border border-line py-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas">
              
                  <LogOutIcon className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div> :
          stage === 'sent' ?
          <div className="pt-1 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-needs/10 text-needs">
                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="auth-title" className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
                  Check your inbox
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  We sent a magic link to <span className="font-medium text-ink">{email}</span>. Open
                  it on this device and you&rsquo;ll be signed straight in — this closes on its own.
                </p>
                <button
              type="button"
              onClick={() => setStage('email')}
              className="mx-auto mt-5 flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink">
              
                  <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Use a different email
                </button>
              </div> :

          <form onSubmit={submit} className="pt-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink">
                  <MailIcon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="auth-title" className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
                  Sign in to your ledger
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  No password. We&rsquo;ll email you a one-time link — your entries stay tied to
                  this address.
                </p>

                <label htmlFor="auth-email" className="mt-5 block text-xs font-medium text-muted">
                  Email address
                </label>
                <input
              id="auth-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'auth-error' : undefined}
              className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink" />
            
                {error &&
            <p id="auth-error" className="mt-2 text-xs text-alert">
                    {error}
                  </p>
            }

                <button
              type="submit"
              disabled={stage === 'sending'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-control bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-70">
              
                  {stage === 'sending' ?
              <>
                      <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending link&hellip;
                    </> :

              'Email me a magic link'
              }
                </button>

                <p className="mt-4 text-center text-[11px] leading-relaxed text-subtle">
                  This app never connects to a bank. Every dollar in it gets typed in on purpose.
                </p>
              </form>
          }
          </motion.div>
        </motion.div>
      }
    </AnimatePresence>);

}