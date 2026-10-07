# Expense Tracker — Project Knowledge

Living reference for Claude (and future you) across sessions. Update this as decisions get made or things change — don't let it go stale.

## What this is

A manual-entry-only household budget tracker. Core thesis: bank-linking/auto-import removes the behavioral benefit of *knowing where money went because you typed it in*. No Plaid, no CSV import, no receipt OCR — ever (this is a permanent non-goal, not a v1 gap). Full product thinking lives in `src/docs/manual_budget_app_prd.md`.

## Stack

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, React Router, Framer Motion, Recharts for charts, lucide-react for icons, `xlsx` (SheetJS) for Excel export
- **Backend**: Supabase (Postgres + auth + RLS) — see `supabase/migrations/`
- **Deploy**: Vercel (`vercel.json` present)
- **Migrations are applied by hand** via the Supabase SQL editor / MCP — there is no `supabase db push` history, and `list_migrations` on the project reflects only what's been applied through the MCP tool. `supabase/migrations/` is the authoritative record *by convention*; verify against the live schema rather than trusting a file's presence. All migrations through 0014 are applied. **Note:** 0010–0013 were applied to the live project out-of-band on 2026-08-31 *before* the files existed here, and were transcribed back afterwards — which is exactly the drift this convention is supposed to prevent. Always `list_migrations` before assuming a numbered file is unapplied.
- Scaffolded originally via Magic Patterns, now hand-developed on top

## Data model (see migrations for source of truth)

- `households` → `profiles` (1:1 with `auth.users`) → each profile belongs to one household
- `household_invites`: email-based invite, becomes a profile on signup via `handle_new_user()` trigger
- `categories`: user-owned, parent is one of **Needs / Wants / Savings**, freeform subcategory name, archivable
- `category_goals`: historized (effective_month), so editing a goal doesn't rewrite past goal-vs-actual charts; `goal_for_month()` resolves the goal in effect for any month via rollover
- `transactions`: amount, category, required description, date, owned by one user but readable by the whole household; `recurring boolean` (migration 0003)
- `income_sources` / `income_deductions` / `income_tax_lines`: manual paystub entry (gross pay, pre/post-tax deductions, tax withholdings) → net take-home calculated in app, not stored redundantly beyond `net_override`

**RLS pattern used throughout**: any household member can `select` any other member's rows (shared visibility); only the owning `user_id` can `insert`/`update`/`delete`. `my_household_id()` is a `security definer` helper that avoids RLS recursion through `profiles`.

**Membership is a two-sided handshake** (migration 0008). `household_invites.status` runs `pending → accepted → confirmed`, and only `confirmed` moves anyone: the invitee accepts (`accept_household_invite`, records intent, shares nothing), then the INVITER confirms the address that actually accepted (`confirm_household_member`, which performs the move). That second step is the only thing standing between a mistyped invite and a stranger reading the household — the accepter's display name is theirs to set, so the UI leads with the email. Invites carry `expires_at` (1 hour), set server-side in `send_household_invite()`; direct INSERT on the table is revoked so a client can't write its own expiry. Exits are `leave_household()` and `remove_household_member()`, both of which move the departing member and their rows into a fresh household rather than deleting anything. All of it funnels through `move_member_to_household()`, which is granted to nobody.

**Membership is not a writable column** (migration 0005). `household_id` is the key every read policy resolves through, so it is *not* in the client's UPDATE grant on `profiles` — nor is `id` or `email`. Same for `household_id`/`user_id` on `transactions` and `categories`. The only way to change households is `accept_household_invite(uuid)`, a `security definer` function that requires the invite be addressed to the caller's own confirmed `auth.users.email`. Before this, any signed-in user could rewrite their own `household_id` and read another household's entire ledger.

⚠️ **When adding a column that gates authorization, add it to the revoke list too.** A column-level `revoke` is silently ignored when the role holds a table-level grant — you must `revoke update on <table>` then `grant update (safe, columns)` back. Likewise `revoke execute ... from public` does *not* remove Supabase's direct grants to `anon`/`authenticated` (see 0007).

## Key product decisions (from PRD, section 9)

- Paystub entry is manual-only for v1; OCR/auto-parse is a deferred fast-follow, not started
- Category goals roll over month to month automatically (carry forward until edited)
- Household aggregate view shows combined spending **and** combined take-home income; per-member income stays private to that member's tab except in the rollup total
- USD only, no multi-currency
- Entry flow is amount-first (type $ → pick Needs/Wants/Savings → subcategory → required description) — this is the highest-frequency, must-stay-fast interaction in the app

## Current state (as of last commits)

- Supabase backend wired up; paystub *upload* UI was removed (manual entry only, per non-goals)
- **Payroll auto-savings are generated server-side** (as of 2026-08-31). `generate_paycheck_entries(as_of)` (migration 0012) runs daily at 09:00 UTC via `pg_cron` (0013) and inserts *real* `transactions` rows with `source = 'auto'` and `income_deduction_id` set, made idempotent by a unique `(income_deduction_id, date)` index (0011). The client-side `generateAutoEntries()` / `payDatesInMonth()` projection was **deleted** — running both double-counted every entry. `BudgetContext` splits mapped rows into `transactions` (the spend ledger, payroll auto excluded) and `payrollEntries`, exposed as `autoEntriesFor(month)` (view-scoped), `myAutoEntriesFor(month)` (self-scoped, used by Settings) and `allAutoEntries`. Settings and the Dashboard Savings bar still read the same numbers, just from rows instead of a projection.
- ⚠️ **The generator only ever writes for `as_of`** — there is no backfill, so any month before the job existed has no payroll entries unless `generate_paycheck_entries(<date>)` is called for those dates. It also skips deductions with no `category_id`, where the old client projection fell back to the first unarchived Savings category. July and August 2026 were backfilled by hand on 2026-08-31 by calling it for 2026-07-15, 07-31, 08-15 and 08-31 (12 rows, $5,586.64) — the 08-31 payday needed it because the cron had already run at 09:00 UTC that morning, before 0014 pinned the schedule. Re-running is safe: the unique index makes it a no-op.
- Take-home pay copy clarified: Settings shows "Already excludes X/mo sent to savings automatically" and per-paycheck rows show "X/paycheck already went to savings"
- Onboarding tracked via `profiles.onboarded` (separate from category count, since starter categories are seeded before onboarding completes)
- Household invite UI is built: email form in Settings.tsx, `inviteMember`/`removeMember` in BudgetContext, writes to `household_invites` table
- Auth is passwordless (magic link via `supabase.auth.signInWithOtp`). `src/lib/supabase.ts` now uses a custom storage adapter that routes the session to `localStorage` (persists indefinitely) or `sessionStorage` (cleared on browser close) based on a "Stay signed in on this device" checkbox in `AuthModal`, controlled by `getRememberMe`/`setRememberMe`. Fixes sessions silently expiring (mainly a Safari/iOS localStorage-eviction issue).
- **Editable first names**: `profiles` already had a `name` column (set from email prefix at signup); `updateMyName()` context action now lets users edit it from AuthModal. Displayed in the header chip, household member list, and anywhere `Member.name` is used.
- **Recurring expenses**: transactions have a `recurring` boolean (migration `0003_recurring_transactions.sql`, applied). Marking a transaction recurring makes it a template; `src/utils/recurring.ts` → `generateRecurringEntries()` projects virtual copies forward into future months on the same day-of-month (clamped to month length). Same "Auto ·" badge as payroll auto-entries but labeled "from Expense". Key distinction from payroll auto-savings: recurring expenses **are** counted in spending totals (Dashboard/Budget/Activity) because they're real cash out, not pre-routed savings. Recurring expenses are still projected live per viewed month with no cron job — unlike payroll auto-savings, which moved server-side on 2026-08-31. Both wear an "Auto ·" badge, so `autoSource` (`'recurring'` vs `'income'`) is what decides whether an entry counts as spending.
- **Excel export (shipped 2026-10-07)**: Export button in the Activity header, visible only on your own tab. `src/utils/export.ts` → `buildMonthSheets()` returns one sheet per month with activity (manual entries + `generateRecurringEntries()` projections + payroll savings, tagged in a `Source` column); `downloadExcel()` writes the workbook, `exportFilename()` names it. **Own data only by design**: every input is filtered to `selfId` inside `buildMonthSheets()`, so household members' rows can't reach the file even though `allTransactions`/`allAutoEntries`/`allCategories` hold the whole household. The month list is derived from the user's own rows, not the context's `months` (which is household-wide). No CSV variant or date-range picker yet.

## Where things live

- `src/pages/`: Dashboard, Activity, Budget, Settings
- `src/components/`: entry sheet, category editor, member tabs, month picker, goal bar, household breakdown, spend trend chart
- `src/components/income/`: income source + deduction editors
- `src/contexts/BudgetContext.tsx`: shared budget state
- `src/utils/recurring.ts`: `generateRecurringEntries()` — projects recurring transactions into future months
- `src/utils/export.ts`: `buildMonthSheets()` / `downloadExcel()` / `exportFilename()` — own-data Excel export, wired into the Activity header
- `src/docs/manual_budget_app_prd.md`: full PRD — read this for any product-decision question before guessing
- `supabase/migrations/`: schema + RLS, chronological

## Open questions / things not yet decided

- Paystub OCR fast-follow: no timeline or design yet
- CSV export of transactions: mentioned as reasonable in PRD (8), not yet built (Excel export shipped 2026-10-07)

## Auth/profile coupling (note)

A `profiles` row and its `auth.users` row must be deleted in that order — deleting the profile alone leaves a working login with no app data, and `handle_new_user()` only fires on INSERT, so it never backfills. That user then hits `.single()` on a missing profile and the app sticks on a blank screen with no recovery. Delete from **Authentication → Users** (which cascades to profiles), never from the Table Editor. Two test accounts hit this on 2026-08-22 and were cleaned up. Migration 0009 adds `ensure_profile()`: the load path in `BudgetContext` uses `maybeSingle()` and calls it when the profile fetch comes back empty, creating a fresh household of one. It's idempotent, and takes a per-user advisory lock so two tabs opening at once can't create two households. It deliberately does not try to restore prior membership — the old rows went with the deleted profile, and rejoining is an invite away.

## Security posture (audit 2026-08-20)

Fixed in 0005–0007:
- **Cross-household read via writable `household_id`** (critical) — see the RLS note above.
- **Silent household capture on signup** (critical) — `handle_new_user()` used to join a new user to whichever household held a pending invite for their email, with no accept step. Anyone could insert an invite for any address, so a squatted invite (or an inviter's typo landing on a real stranger) handed over the ledger. Signup now always creates a household of one; joining requires `accept_household_invite()`.
- **`household_id` unpinned on UPDATE** for `transactions`/`categories` — INSERT checked it, UPDATE didn't, so a user could push their own rows into another household.
- Anon-reachable `security definer` RPCs; `goal_for_month` mutable `search_path`.

Known and *not* yet fixed:
- **Income is not private within a household.** RLS grants every member full read of `income_sources`/`income_deductions`/`income_tax_lines` — gross pay, every deduction, every tax line. The PRD's "per-member income stays private to that member's tab" is enforced only by which React tab is rendered, not by a policy. Decide whether that's a real promise before building on it.
- **Verify the Supabase redirect allowlist** (Auth → URL Configuration). `sendMagicLink` passes `emailRedirectTo: window.location.origin`; if that list is wildcarded, a cloned app can have a magic-link token delivered to its own domain.
- Table policies from 0001 are still scoped `to public` rather than `to authenticated`; re-scoping them would let `my_household_id()` drop its anon grant too.
- `xlsx@0.18.5` carries CVE-2023-30533 / CVE-2024-22363. Low exploitability (input is the user's own data), but the fixed builds live off-npm.
