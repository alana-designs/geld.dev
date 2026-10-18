# Expense Tracker — Backlog

Product improvement ideas and future work. Add to this whenever an idea comes up mid-session; review/reprioritize periodically. Move items to "Shipped" (with date) once done — keeps a lightweight changelog too.

## Now / Next

- ~~Decide whether to restore the lost payroll entries~~ — **done 2026-10-18.** 18 rows / $8,379.96 inserted (Jul 15/31, Aug 15/31, Sep 15/30 × Emergency Fund Contribution $500.00, HSA $146.66, Roth 401k Contribution $750.00), reconstructed from the app's own 2026-10-07 export rather than regenerated — `generate_paycheck_entries(<past date>)` would have stamped today's rate on history. Descriptions preserved verbatim from the export. Inserted **with** `income_deduction_id` set, not null as first proposed: by the time the restore ran, all three deductions were configured again on income source `83142420`, so the real links were available and the unique index keeps the cron idempotent over the restored rows. 2026-10-15 left empty at the owner's instruction. Detail in KNOWLEDGE.md.
- **Confirm the paystub still matches the three configured deductions.** An earlier snapshot today showed only Emergency Fund Contribution ($500.00) on the income source, which looked like HSA and Roth 401k had been dropped; as of the 18:33 UTC save all three are configured again ($1,396.66/payday total), so the alarm has passed. Worth one check against a current paystub anyway, since the sheet silently filters out any deduction whose amount is blank or ≤ 0 — that is how a line can vanish from a save without anyone noticing.
- **No way to clean up orphaned payroll entries.** Since 0016, deleting a deduction (or a whole income source) leaves its posted entries behind with a null `income_deduction_id` — deliberately, since they're history. But there's no view that lists them and no bulk delete; the only lever is deleting them one at a time from Activity.

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

- **Editing an income source no longer destroys its payroll history (2026-10-18, v1.2.1, migration 0016)** — `saveIncomeSource()` reconciled deductions by id instead of deleting every row for the source and re-inserting them with fresh ids, which had been cascading away every auto savings entry those deductions ever generated, silently, on an ordinary edit. Updates what still exists, inserts what's new, deletes only what the user actually removed; local state is rebuilt from the rows the DB returns rather than the ones sent. As a second line of defence `transactions.income_deduction_id` became `ON DELETE SET NULL`, so even a genuine deduction delete leaves the posted entries in the ledger — the money did leave those paychecks on those dates. `EntryRow` now gates the per-entry delete on `autoSource` rather than on the deduction link, so an orphaned entry is still deletable. Idempotency is unaffected (0011's unique index is partial on `income_deduction_id is not null`) and `paycheck_entry_skips` still cascades by design. Changelog entry added. The lost entries were restored the same day (see Now / Next). Still open: nothing lists or bulk-deletes orphaned auto entries.

- **Delete one payroll savings entry (2026-10-18, v1.2, migration 0015)** — expand an `Auto · from paycheck` entry in Activity or on the Dashboard and "Delete this one" removes it. `delete_paycheck_entry()` writes a `paycheck_entry_skips` tombstone and deletes the transaction in one statement, so `generate_paycheck_entries()` won't re-post it; everything is scoped to that single pay date, and the income source and its deductions are untouched. Also closed a hole 0012 left open: `generate_paycheck_entries()` was callable over REST by anon and authenticated. Changelog entry added. Still open: no undo (a skip can only be removed in SQL), and no way to *correct* an entry's amount — delete is the only lever.

- **Excel export of your own activity (2026-10-07, v1.1)** — Export button in the Activity header (own tab only) downloads a `.xlsx` with one sheet per month that has activity. `buildMonthSheets()` in `src/utils/export.ts` filters everything to `selfId` up front, so household members' rows can never reach the file. Includes manual entries, recurring projections and payroll savings (labelled in a Source column). Replaces the earlier multi-member `buildExportRows()`. Changelog entry added. Free-text column is labelled "Note". Still open: CSV variant, date-range picker.

- **Semimonthly pay date picker (2026-08-31, migrations 0010–0014)** — salaried income sources now store which pair of semimonthly days the paycheck lands on ('first_fifteenth' or 'fifteenth_last'). Old hardcoded 15th/last assumption gone. Existing rows backfilled to 'fifteenth_last'. Also fixed double-counting: client-side `generateAutoEntries()` / `payDatesInMonth()` deleted; server-side `generate_paycheck_entries()` (pg_cron, 0012–0013) is now the sole source of payroll auto-savings rows.

- **In-app changelog (2026-08-19)** — `WhatsNewCard` at foot of desktop sidebar + Settings row for mobile. `ChangelogModal` lists releases newest-first from `src/data/changelog.ts`. "Unread" dot tracked via localStorage.

- **Responsive nav + layout (2026-08-17)** — `SideRail` (desktop fixed left nav), `AddExpenseButton` (desktop, next to MonthPicker), `TopCategories` "Where it's going" widget (top 5 spend categories with goal bars). `SpendTrend.tsx` removed. App renamed "Geld" throughout.

- **Hourly income (2026-08-17, migration 0004)** — "Add income" opens with Salaried vs. Hourly choice. Hourly paychecks are one-per-source with a received date; count toward the month received, no payroll auto-savings. Settings gets a MonthPicker for hourly paycheck filtering. `monthlyNet()` is now month-aware.

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
