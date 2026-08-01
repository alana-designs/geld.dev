import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UserIcon } from 'lucide-react';
import { BudgetProvider, useBudget } from './contexts/BudgetContext';
import { BottomNav } from './components/BottomNav';
import { EntrySheet } from './components/EntrySheet';
import { AuthModal } from './components/AuthModal';
import { OnboardingSetup } from './components/OnboardingSetup';
import { Dashboard } from './pages/Dashboard';
import { Activity } from './pages/Activity';
import { Budget } from './pages/Budget';
import { Settings } from './pages/Settings';

function Shell() {
  const { user, loading, sendMagicLink, signOut, setupComplete, canEdit, selfId, setViewId } =
  useBudget();
  const [addOpen, setAddOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  // First run: claim the ledger with an email before anything else.
  useEffect(() => {
    if (!loading && !user) {
      const t = setTimeout(() => setAuthOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [user, loading]);

  // Real sign-in happens asynchronously (the user opens the emailed link,
  // maybe on another tab) — close the modal reactively once a session lands.
  useEffect(() => {
    if (user) setAuthOpen(false);
  }, [user]);

  const needsSetup = Boolean(user) && !loading && !setupComplete;

  // You can only ever add entries to your own ledger.
  const openAdd = () => {
    if (!canEdit && selfId) setViewId(selfId);
    setAddOpen(true);
  };

  return (
    <div className="min-h-full w-full bg-canvas font-sans">
      <div className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <span className="text-sm font-bold tracking-[-0.03em] text-ink">Expense Tracker</span>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink">
            
            <UserIcon className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
            <span className="max-w-[10rem] truncate">{user ? user.email : 'Sign in'}</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-3">
        <Routes>
          <Route path="/" element={<Dashboard onAdd={openAdd} />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/budget" element={<Budget />} />
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
        onSendMagicLink={sendMagicLink} />


      {needsSetup && <OnboardingSetup />}
    </div>);

}

export function App() {
  return (
    <BudgetProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </BudgetProvider>);

}