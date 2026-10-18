import React, { useState } from 'react';
import { ArrowLeftIcon, CheckIcon, LoaderIcon, MailIcon } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { LoginShowcase } from './LoginShowcase';
import './Login.css';

/**
 * Signed-out landing screen, ported from the Claude Design comp: sign-in card
 * on the left, a looping preview of the app on the right.
 *
 * Two deliberate departures from the comp, which was drawn while Google was
 * still only planned: the Google button is live rather than badged "Soon", and
 * it carries Google's own mark instead of a plain letter G, which is what
 * their branding terms ask for on a real sign-in button.
 */

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = 'email' | 'sending' | 'sent' | 'redirecting';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
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
  const [stage, setStage] = useState<Stage>('email');
  const [error, setError] = useState<string | null>(null);

  const busy = stage === 'sending' || stage === 'redirecting';

  const google = async () => {
    setError(null);
    setStage('redirecting');
    const { error: oauthError } = await signInWithGoogle(remember);
    if (oauthError) {
      setError(oauthError);
      setStage('email');
    }
    // On success the browser leaves for Google, so there's nothing to reset —
    // the redirect back lands on the app with a session.
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!emailPattern.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setStage('sending');
    const { error: sendError } = await sendMagicLink(trimmed, remember);
    if (sendError) {
      setError(sendError);
      setStage('email');
      return;
    }
    setStage('sent');
  };

  return (
    <div className="geld-login">
      <section className="signin" aria-label="Sign in">
        <div className="signin-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              G
            </span>
            Geld
          </div>

          <div className="signin-center">
            <div className="modal" role="dialog" aria-labelledby="auth-title">
              {stage === 'sent' ? (
                <div className="sent">
                  <div className="icon-circle ok">
                    <CheckIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h1 id="auth-title">Check your inbox</h1>
                  <p className="lede">
                    We sent a magic link to{' '}
                    <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>{email.trim()}</strong>
                    . Open it on this device and you&rsquo;ll be signed straight in.
                  </p>
                  <button type="button" className="link" onClick={() => setStage('email')}>
                    <ArrowLeftIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <div className="icon-circle">
                    <MailIcon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h1 id="auth-title">Sign in to your ledger</h1>
                  <p className="lede">
                    No password. Use Google, or have a one-time link emailed to you — either way
                    you land in the same ledger.
                  </p>

                  <label className="field" htmlFor="auth-email">
                    Email address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'auth-error' : undefined}
                  />
                  {error && (
                    <p className="err" id="auth-error">
                      {error}
                    </p>
                  )}

                  <label className="remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Stay signed in on this device
                  </label>

                  <button type="submit" className="btn" disabled={busy}>
                    {stage === 'sending' ? (
                      <>
                        <LoaderIcon className="spin h-4 w-4" aria-hidden="true" />
                        Sending link&hellip;
                      </>
                    ) : (
                      'Email me a magic link'
                    )}
                  </button>

                  <div className="or" aria-hidden="true">
                    or
                  </div>

                  <button type="button" className="btn btn-google" onClick={google} disabled={busy}>
                    {stage === 'redirecting' ? (
                      <LoaderIcon className="spin h-4 w-4" aria-hidden="true" />
                    ) : (
                      <GoogleMark />
                    )}
                    Continue with Google
                  </button>

                  <p className="note">
                    Already have entries here? Use the same address you signed up with — that&rsquo;s
                    what ties the two together.
                  </p>

                  <p className="fine">
                    This app never connects to a bank. Every dollar in it gets typed in on purpose.
                  </p>
                </form>
              )}
            </div>
          </div>

          <div className="foot">
            <span>geld.dev</span>
            <span>Manual entry. No bank linking.</span>
          </div>
        </div>
      </section>

      <LoginShowcase />
    </div>
  );
}
