# Expense Tracker — Backlog

Product improvement ideas and future work. Add to this whenever an idea comes up mid-session; review/reprioritize periodically. Move items to "Shipped" (with date) once done — keeps a lightweight changelog too.

## Now / Next

- **CSV/Excel export UI** — utility layer is done (`src/utils/export.ts`: `buildExportRows()` + `downloadExcel()`; `xlsx` dep added; BudgetContext exposes `allCategories`/`allTransactions`/`allIncomeSources`; `rollups.ts` has `monthsByYear()` helpers). Still needs: UI for picking date range + members, and a trigger (button in Activity or Settings).

## Backlog

- **Household privacy decision: is income private within a household?** RLS lets any member read every other member's `income_sources`/`income_deductions`/`income_tax_lines` (gross pay, deductions, tax lines). The PRD says per-member income stays private outside the rollup — that's currently enforced only by which tab the client renders. Either write the policy or drop the claim.
- **Re-scope 0001 policies from `to public` to `to authenticated`**, then drop `my_household_id()`'s anon EXECUTE grant (the last remaining security-advisor warning).
- **Bump `xlsx`** off 0.18.5 (CVE-2023-30533, CVE-2024-22363) — fixed builds are published off-npm by SheetJS.
- **Paystub OCR / auto-parse** — deferred fast-follow per PRD, once core manual-entry flows are validated. Explicitly *not* the same as bank-linking (still no transaction import) — just reduces manual typing of paystub line items

## Icebox / Non-goals (do not build without a deliberate decision to reverse course)

- Bank/institution linking (Plaid, etc.) — against the product's core purpose
- Any automatic transaction import (CSV bank statements, email receipt parsing)
- Bill-pay or money movement
- Credit score, net worth, or investment performance tracking
- Native mobile app
- Multi-currency / locale support

## Shipped

- **`ensure_profile()` self-heal (2026-08-22, migration 0009)** — an `auth.users` row with no `profiles` row used to be a permanently stuck account, since `handle_new_user()` only fires on INSERT and the load path called `.single()`. The client now uses `maybeSingle()` and calls `ensure_profile()` on a miss, which rebuilds a household of one. Idempotent, advisory-locked per user. Create path is not yet exercised end-to-end — see the note in KNOWLEDGE.md.

- **Membership handshake, expiry and exits (2026-08-22, migration 0008)** — invites now expire after an hour (`expires_at`, set server-side; direct INSERT revoked) and joining takes both sides: the invitee accepts, then the inviter confirms the address that accepted before anything moves. `send_household_invite` / `accept_household_invite` / `confirm_household_member` / `decline_household_member`, the `my_pending_invites` + `pending_member_confirmations` queues, and `leave_household` / `remove_household_member` — both exits move the member and their rows to a fresh household rather than deleting. UI: `ConfirmMemberCard` (leads with the email, since the name is attacker-chosen), reworked `IncomingInviteCard` with a live countdown, and `MembershipConfirmModal` for both exits. Design canvas: the /design artifact for these flows.

- **Household membership hardening (2026-08-20, migrations 0005–0007)** — closed two ways one user could reach another's data. `household_id` is no longer in the client's UPDATE grant (it was the key every read policy resolves through, so rewriting it read another household's whole ledger); signup no longer silently joins a household holding an invite for your email; `household_id`/`user_id` pinned on `transactions`/`categories` UPDATE; anon RPC surface revoked. Joining is now `accept_household_invite()` + an accept card in Settings (`src/components/IncomingInviteCard.tsx`), which spells out that your existing entries move with you.

- Supabase backend wired up; paystub upload UI removed in favor of manual-only entry
- Unified auto-savings calculation, reflected in Dashboard Savings progress bar
- Clarified take-home pay copy
- **Household invite flow UI** — email invite form in Settings; `inviteMember`/`removeMember` in BudgetContext write to `household_invites`; member list renders existing household members with remove option
- **"Stay signed in" / remember-me for magic-link auth** — Supabase client now uses a routed storage adapter (localStorage vs sessionStorage) based on a checkbox in AuthModal, so sessions persist indefinitely until sign-out or cache clear instead of silently expiring (fixes iOS/Safari localStorage eviction causing random logouts)
- **Editable first names** — "First name" field in AuthModal; `updateMyName()` in BudgetContext; shows in header chip and all member name displays
- **Recurring expenses** — "Repeats monthly on this date" checkbox in EntrySheet; `generateRecurringEntries()` in `src/utils/recurring.ts` projects virtual copies into future months (same day-of-month, clamped); counted in spending totals unlike payroll auto-savings; "Auto · from Expense" badge. Migration `0003_recurring_transactions.sql` is applied.
