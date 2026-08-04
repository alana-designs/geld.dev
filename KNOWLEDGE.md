# Expense Tracker — Project Knowledge

Living reference for Claude (and future you) across sessions. Update this as decisions get made or things change — don't let it go stale.

## What this is

A manual-entry-only household budget tracker. Core thesis: bank-linking/auto-import removes the behavioral benefit of *knowing where money went because you typed it in*. No Plaid, no CSV import, no receipt OCR — ever (this is a permanent non-goal, not a v1 gap). Full product thinking lives in `src/docs/manual_budget_app_prd.md`.

## Stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, React Router, Framer Motion, Recharts for charts, lucide-react for icons
- **Backend**: Supabase (Postgres + auth + RLS) — see `supabase/migrations/`
- **Deploy**: Vercel (`vercel.json` present)
- Scaffolded originally via Magic Patterns, now hand-developed on top

## Data model (see migrations for source of truth)

- `households` → `profiles` (1:1 with `auth.users`) → each profile belongs to one household
- `household_invites`: email-based invite, becomes a profile on signup via `handle_new_user()` trigger
- `categories`: user-owned, parent is one of **Needs / Wants / Savings**, freeform subcategory name, archivable
- `category_goals`: historized (effective_month), so editing a goal doesn't rewrite past goal-vs-actual charts; `goal_for_month()` resolves the goal in effect for any month via rollover
- `transactions`: amount, category, required description, date, owned by one user but readable by the whole household
- `income_sources` / `income_deductions` / `income_tax_lines`: manual paystub entry (gross pay, pre/post-tax deductions, tax withholdings) → net take-home calculated in app, not stored redundantly beyond `net_override`

**RLS pattern used throughout**: any household member can `select` any other member's rows (shared visibility); only the owning `user_id` can `insert`/`update`/`delete`. `my_household_id()` is a `security definer` helper that avoids RLS recursion through `profiles`.

## Key product decisions (from PRD, section 9)

- Paystub entry is manual-only for v1; OCR/auto-parse is a deferred fast-follow, not started
- Category goals roll over month to month automatically (carry forward until edited)
- Household aggregate view shows combined spending **and** combined take-home income; per-member income stays private to that member's tab except in the rollup total
- USD only, no multi-currency
- Entry flow is amount-first (type $ → pick Needs/Wants/Savings → subcategory → required description) — this is the highest-frequency, must-stay-fast interaction in the app

## Current state (as of last commits)

- Supabase backend wired up; paystub *upload* UI was removed (manual entry only, per non-goals)
- Auto-savings calculation uses `generateAutoEntries(incomeSources, activeCategories, selectedMonth)` + `totalOf()` — same code path as the Dashboard Savings bar, so Settings and Dashboard always agree
- Take-home pay copy clarified: Settings shows "Already excludes X/mo sent to savings automatically" and per-paycheck rows show "X/paycheck already went to savings"
- Onboarding tracked via `profiles.onboarded` (separate from category count, since starter categories are seeded before onboarding completes)
- Household invite UI is built: email form in Settings.tsx, `inviteMember`/`removeMember` in BudgetContext, writes to `household_invites` table
- Auth is passwordless (magic link via `supabase.auth.signInWithOtp`). `src/lib/supabase.ts` now uses a custom storage adapter that routes the session to `localStorage` (persists indefinitely) or `sessionStorage` (cleared on browser close) based on a "Stay signed in on this device" checkbox in `AuthModal`, controlled by `getRememberMe`/`setRememberMe`. Fixes sessions silently expiring (mainly a Safari/iOS localStorage-eviction issue).

## Where things live

- `src/pages/`: Dashboard, Activity, Budget, Settings
- `src/components/`: entry sheet, category editor, member tabs, month picker, goal bar, household breakdown, spend trend chart
- `src/components/income/`: income source + deduction editors
- `src/contexts/BudgetContext.tsx`: shared budget state
- `src/docs/manual_budget_app_prd.md`: full PRD — read this for any product-decision question before guessing
- `supabase/migrations/`: schema + RLS, chronological

## Open questions / things not yet decided

- Paystub OCR fast-follow: no timeline or design yet
- CSV export of transactions: mentioned as reasonable in PRD (8), not yet built
