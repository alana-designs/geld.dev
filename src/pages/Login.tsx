import React, { useState } from 'react';
import { ArrowLeftIcon, CheckIcon, LoaderIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

/**
 * Signed-out landing screen. The markup here is intentionally plain — the real
 * design is being drawn separately and will be ported in. Everything that
 * matters (provider calls, remember-me, redirect-back, error states) lives in
 * the handlers below, so swapping the visuals shouldn't touch the logic.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = 'idle' | 'sending' | 'sent' | 'redirecting';

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function Login() {
  const { sendMagicLink, signInWithGoogle } = useBudget();
  const [email, setEmail] = useState('');
  const [remember, setRemember] = useState(true);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setError(null);
    setStage('redirecting');
    const { error: oauthError } = await signInWithGoogle(remember);
    if (oauthError) {
      setError(oauthError);
      setStage('idle');
    }
    // On success the browser navigates away to Google, so there's nothing to
    // reset here — the redirect back lands on the app with a session.
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPattern.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setStage('sending');
    const { error: sendError } = await sendMagicLink(email.trim(), remember);
    if (sendError) {
      setError(sendError);
      setStage('idle');
      return;
    }
    setStage('sent');
  };

  const busy = stage === 'sending' || stage === 'redirecting';

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-ink">Geld</h1>

        {stage === 'sent' ? (
          <div className="mt-6 rounded-card border border-line bg-surface p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-needs/10 text-needs">
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-ink">
              Check your inbox
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              We sent a sign-in link to <span className="font-medium text-ink">{email}</span>. Open
              it on this device and you&rsquo;ll land straight back here.
            </p>
            <button
              type="button"
              onClick={() => setStage('idle')}
              className="mt-5 flex items-center gap-1.5 text-xs font-medium text-subtle hover:text-ink"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Use a different email
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-card border border-line bg-surface p-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">
              Sign in to your ledger
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Use Google, or have a one-time link emailed to you. Either way you land in the same
              ledger.
            </p>

            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-control border border-line bg-surface py-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas disabled:opacity-60"
            >
              {stage === 'redirecting' ? (
                <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <GoogleMark />
              )}
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={submit}>
              <label htmlFor="login-email" className="block text-xs font-medium text-muted">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
                className="mt-1.5 w-full rounded-control border border-line bg-surface px-3 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-subtle focus:border-ink"
              />

              <button
                type="submit"
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-control bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-70"
              >
                {stage === 'sending' ? (
                  <>
                    <LoaderIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending link&hellip;
                  </>
                ) : (
                  'Email me a sign-in link'
                )}
              </button>
            </form>

            {error && (
              <p id="login-error" className="mt-3 text-xs text-alert">
                {error}
              </p>
            )}

            <label className="mt-4 flex items-center gap-2 text-xs font-medium text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-line text-primary accent-primary"
              />
              Stay signed in on this device
            </label>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] leading-relaxed text-subtle">
          This app never connects to a bank. Every dollar in it gets typed in on purpose.
        </p>
      </div>
    </div>
  );
}
