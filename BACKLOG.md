# Expense Tracker — Backlog

Product improvement ideas and future work. Add to this whenever an idea comes up mid-session; review/reprioritize periodically. Move items to "Shipped" (with date) once done — keeps a lightweight changelog too.

## Now / Next

*(nothing prioritized yet — add ideas here as they come up)*

## Backlog

- **CSV export** of raw transactions — explicitly called out in the PRD as reasonable to include since it's the user's own typed-in data, not an import feature
- **Paystub OCR / auto-parse** — deferred fast-follow per PRD, once core manual-entry flows are validated. Explicitly *not* the same as bank-linking (still no transaction import) — just reduces manual typing of paystub line items

## Icebox / Non-goals (do not build without a deliberate decision to reverse course)

- Bank/institution linking (Plaid, etc.) — against the product's core purpose
- Any automatic transaction import (CSV bank statements, email receipt parsing)
- Bill-pay or money movement
- Credit score, net worth, or investment performance tracking
- Native mobile app
- Multi-currency / locale support

## Shipped

- Supabase backend wired up; paystub upload UI removed in favor of manual-only entry
- Unified auto-savings calculation, reflected in Dashboard Savings progress bar
- Clarified take-home pay copy
- **Household invite flow UI** — email invite form in Settings; `inviteMember`/`removeMember` in BudgetContext write to `household_invites`; member list renders existing household members with remove option
- **"Stay signed in" / remember-me for magic-link auth** — Supabase client now uses a routed storage adapter (localStorage vs sessionStorage) based on a checkbox in AuthModal, so sessions persist indefinitely until sign-out or cache clear instead of silently expiring (fixes iOS/Safari localStorage eviction causing random logouts)
