import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoaderIcon, UserIcon } from 'lucide-react';
import { BudgetProvider, useBudget } from './contexts/BudgetContext';
import { consumePostAuthPath, hasAuthCallback, setPostAuthPath } from './lib/supabase';
import { BottomNav } from './components/BottomNav';
import { SideRail } from './components/SideRail';
import { EntrySheet } from './components/EntrySheet';
import { AuthModal } from './components/AuthModal';
import { OnboardingSetup } from './components/OnboardingSetup';
import { Dashboard } from './pages/Dashboard';
import { Activity } from './pages/Activity';
import { Budget } from './pages/Budget';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';

function Splash() {
  return (
    <div className="flex min-h-full w-full items-center justify-center bg-canvas">
      <LoaderIcon className="h-5 w-5 animate-spin text-subtle" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/**
 * Decides between the login screen and the app. Signed-out visitors are sent
 * to /login with the page they were after remembered, so they land back on it
 * once the session arrives.
 */
function Gate() {
  const { user, loading } = useBudget();
  const location = useLocation();

  // Coming back from Google or an emailed link, the session isn't in place for
  // the first moment or two while the callback is exchanged. Hold the splash
  // rather than flashing the login screen at someone who just signed in.
  const [settling, setSettling] = useState(hasAuthCallback);
  useEffect(() => {
    if (!settling) return;
    if (user) {
      setSettling(false);
      return;
    }
    const t = setTimeout(() => setSettling(false), 5000);
    return () => clearTimeout(t);
  }, [settling, user]);

  const atLogin = location.pathname === '/login';

  if (loading || settling) return <Splash />;

  if (!user) {
    if (atLogin) return <Login />;
    setPostAuthPath(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  if (atLogin) return <Navigate to={consumePostAuthPath()} replace />;

  return <Shell />;
}

function Shell() {
  const {
    user,
    loading,
    signOut,
    setupComplete,
    canEdit,
    selfId,
    selfName,
    updateMyName,
    setViewId
  } = useBudget();
  const [addOpen, setAddOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const needsSetup = Boolean(user) && !loading && !setupComplete;

  // You can only ever add entries to your own ledger.
  const openAdd = () => {
    if (!canEdit && selfId) setViewId(selfId);
    setAddOpen(true);
  };

  return (
    <div className="min-h-full w-full bg-canvas font-sans lg:pl-60">
      <SideRail onAccount={() => setAuthOpen(true)} />

      <div className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <span className="text-sm font-bold tracking-[-0.03em] text-ink">Geld</span>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink">

            <UserIcon className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
            <span className="max-w-[10rem] truncate">
              {user ? selfName ?? user.email : 'Sign in'}
            </span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-3 lg:max-w-4xl lg:px-8 lg:pb-10 lg:pt-7">
        <Routes>
          <Route path="/" element={<Dashboard onAdd={openAdd} />} />
          <Route path="/activity" element={<Activity onAdd={openAdd} />} />
          <Route path="/budget" element={<Budget onAdd={openAdd} />} />
          <Route path="/settings" element={<Settings onSignIn={() => setAuthOpen(true)} />} />
        </Routes>
      </main>

      <BottomNav onAdd={openAdd} />

      <EntrySheet open={addOpen} onClose={() => setAddOpen(false)} />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        signedInEmail={user?.email ?? null}
        onSignOut={signOut}
        name={selfName}
        onSaveName={updateMyName} />


      {needsSetup && <OnboardingSetup />}
    </div>);

}

export function App() {
  return (
    <BudgetProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </BudgetProvider>);

}
