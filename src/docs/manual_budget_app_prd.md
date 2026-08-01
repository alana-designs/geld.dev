# PRD: [Working Title] Manual Budget Tracker

## 1. Problem & Vision

Most budgeting apps auto-import transactions via bank linking. This removes friction, but it also removes the behavioral benefit of *knowing where your money went because you typed it in yourself*. Automatic tracking lets people disengage from their spending.

This product is a **manual-entry-only** budgeting web app. Every dollar in the app was typed in by a human, on purpose. The friction is the feature. In exchange, the app should make that manual entry as fast and pleasant as possible, and reward the effort with beautiful, interactive visualization of where money is going — daily and over time.

**Core design principle:** No bank linking, no auto-import, no CSV transaction import, ever. Manual entry is not a v1 limitation to remove later — it's the product's core behavioral mechanism.

## 2. Goals

- Give users an accurate picture of take-home pay (post-deduction), not just gross income
- Make manual transaction entry fast enough that it doesn't feel like a chore (amount-first flow)
- Let users organize spending their own way, while still rolling up to standard budgeting parent categories
- Support a household of multiple people, each with their own income/budget, with shared visibility
- Turn manually-entered data into daily and monthly visuals that are genuinely satisfying to look at

## 3. Non-Goals (v1)

- No bank/institution linking (Plaid, etc.) — explicitly against the product's purpose
- No automatic transaction import of any kind (no CSV bank statement upload, no email parsing of receipts)
- No bill-pay or money movement — this is a tracker, not a payments product
- No credit score, net worth, or investment performance tracking (retirement/investment *contributions* are tracked as a savings category, not performance)
- No native mobile app in v1 (responsive web only)

## 4. Users & Household Model

Based on your current spreadsheet (which already tracks two people — Alana and Andrew — with separate monthly trackers), the app should support:

- **Household**: a group of 1+ people who share visibility into each other's budgets
- **Members**: each person is invited to a household via email. Each member:
  - Sets up their **own** income and their **own** budget/categories (incomes aren't shared/combined, since household members may not share income)
  - Gets their own **tab** (or equivalent view) within the household — e.g. "Alana" / "Andrew" tabs, matching the mental model of your current spreadsheet
- **Shared visibility**: any household member can view (read-only) any other member's tab/budget — categories, entries, charts. No editing another member's data.
- **Optional combined view**: a "Household" tab that aggregates both members' spending by parent category (Needs/Wants/Savings) for a whole-household picture, without merging individual budgets
- A user can belong to exactly one household in v1 (no multi-household support needed initially)
- A single user with no household invites is just a household of one — this should not feel like a degraded experience

**Invite flow:** Member adds a household by entering another person's email → invitee receives an email invite → accepts → their tab appears in the shared household view once they've set up their own budget.

## 5. Core Features

### 5.1 Income Setup (Paystub)

Goal: get to an accurate **take-home pay** number, with pre-tax and post-tax deductions itemized, so the budget is built on real available cash, not gross salary.

- **Manual entry only for v1**: same fields a paystub would have, typed in by hand. No paystub upload or OCR/auto-parse in v1 — deferred to a fast-follow once core flows are validated.
- Fields to capture per income source:
  - Gross pay (per pay period + pay frequency: weekly/biweekly/semi-monthly/monthly)
  - Pre-tax deductions (401k/retirement, HSA/FSA, pre-tax health premiums, etc.) — user-labeled, itemized
  - Taxes withheld (federal, state, local, FICA) — itemized, informational (not user-editable categories, just line items)
  - Post-tax deductions (Roth contributions, benefits, garnishments, etc.) — user-labeled, itemized
  - Net/take-home pay (calculated, shown prominently, editable if the user wants to override)
- Support **multiple income sources** per user (e.g. two jobs, a spouse's separate paycheck is handled via that spouse's own household tab)
- Recurring income: user sets pay frequency so take-home flows into a monthly income figure used for budget totals
- Users can update income any time it changes (raise, new job, benefits change)

### 5.2 Categories

- Three fixed **parent categories** for budgeting structure: **Needs**, **Wants**, **Savings**
- Users create their own **custom subcategories** under each parent (e.g., under Needs: Rent, Groceries, Utilities, Car Payment; under Wants: Eating Out, Shopping, Concerts, Hobbies; under Savings: Retirement, Emergency Fund, Brokerage)
- Groceries and Eating Out must be distinct categories by default (per your requirement) — seed data should reflect this split, not lump them together
- Each subcategory gets a monthly goal/budget amount (optional but encouraged — mirrors the "Goal" row in your current tracker)
- Categories are editable/archivable at any time; archiving preserves historical data but hides from new-entry pickers
- Suggested starter categories (seeded from patterns in your existing tracker, editable/removable):
  - **Needs**: Rent/Mortgage, Groceries, Utilities, Phone, Internet, Car Payment, Car Insurance, Car Maintenance, Gas/Transportation, Debt Payments, Pets, Household
  - **Wants**: Eating Out, Shopping, Subscriptions, Gym, Social Events, Hobbies, Concerts
  - **Savings**: Retirement Contribution, Emergency Fund, Brokerage/Investing, Crypto

### 5.3 Manual Transaction Entry

- **Amount-first flow**: user opens "add entry," types the dollar amount first, *then* selects category — matches how people actually think about a purchase they just made
- After amount: pick parent category (Needs/Wants/Savings) → then subcategory (or search/quick-select if they have many)
- **Description is required, not optional**: the last step of entry is a short free-text description of what the expense actually was (e.g. "Farmers market produce," "Uber to airport," "Sara's birthday dinner"). This is the field that makes historical data legible months later — a category tells you *what bucket*, the description tells you *what happened*. Keep it a single short text field, not a form.
- Other fields: date (defaults to today), which household member it belongs to (defaults to self) — both optional/editable
- Entry should still be completable in well under 10 seconds for a repeat category, including typing the description — this is the make-or-break interaction of the whole product
- Support quick-add of a brand-new subcategory inline, without leaving the entry flow
- Edit/delete any past entry, including its description
- No transaction limit — designed for many small manual entries per day

### 5.4 Visualization

- **Entry display order (everywhere an entry is listed — daily view, monthly history, search/filter results)**: description first, Needs/Wants/Savings label second, amount last. The description is the headline of the row; the parent-category label is a small tag/badge (color-coded, per section 5.2); the amount is right-aligned. This mirrors reading a bank/spreadsheet line item — "what it was" is what you scan for, "how much" is what you confirm.
- **Historical notes, spreadsheet-style**: every past entry's description remains attached and viewable the way a note or comment attaches to a spreadsheet cell — visible inline if there's room, or on hover/tap if the row is compact. Long descriptions truncate in list view but are never lost; clicking/tapping an entry always shows the full description. Descriptions should also be searchable (e.g. searching "birthday" surfaces every entry described that way, regardless of category).
- **Daily view**: a day's entries listed simply (description → category label → amount), with a running daily total and a small per-day breakdown by parent category
- **Monthly trends**: the primary dashboard — spending over the month/across months, broken out by:
  - Parent category (Needs/Wants/Savings) — e.g. donut or stacked bar showing the split, with goal vs. actual
  - Each subcategory — its own small chart (spend over time within the month, or vs. its goal)
- Charts should be **interactive**: click/hover a category to filter the entry list to just that category, toggle between parent categories, switch between daily/weekly/monthly time grouping
- Visual style: simple and clean — favor a small number of chart types done well (e.g. stacked bar for category mix, line for trend, donut for allocation) over a dashboard crowded with widgets
- Include a "goal vs. actual" indicator per category (like the Goal/Actual Totals rows in your current spreadsheet) — over/under budget should be visually obvious at a glance
- Household aggregate view (if applicable) uses the same visual language, rolled up across members, and includes combined take-home income (e.g. whole-household savings rate) alongside combined spending

## 6. Data Model (high level, for design/dev reference)

```
Household
 └─ Members (User) [1..n]
     ├─ IncomeSources [1..n]
     │    ├─ grossPay, payFrequency
     │    ├─ PreTaxDeductions [n]  (label, amount)
     │    ├─ TaxWithholdings [n]   (label, amount)
     │    ├─ PostTaxDeductions [n] (label, amount)
     │    └─ netTakeHome (calculated)
     ├─ Categories [1..n]
     │    ├─ parentType: Needs | Wants | Savings
     │    ├─ name (user-defined)
     │    ├─ monthlyGoal (optional)
     │    └─ archived (bool)
     └─ Transactions [1..n]
          ├─ amount
          ├─ categoryId (resolves to parentType + subcategory label)
          ├─ description (required — free text, what the expense was)
          ├─ date
          └─ createdAt (for daily/monthly rollups)
```

## 7. Key User Flows

1. **First-time setup**: Sign up → manually enter income → review calculated take-home pay → set up starter categories (accept suggested set or customize) → optionally set monthly goals per category → land on empty-state dashboard with a clear "Add your first entry" CTA
2. **Daily entry**: Open app → tap "Add" → type amount → select Needs/Wants/Savings → select subcategory → type a short description of what it was → (optional) adjust date → save → entry appears immediately in today's list as *description → category label → amount*, and totals/charts update
3. **Reviewing spending**: Open dashboard → default view is current month → toggle to a specific parent category or subcategory → see trend + goal-vs-actual → drill into daily entries behind any data point
4. **Inviting a household member**: Settings → "Invite to household" → enter email → member receives invite, signs up, completes their own income/category setup → their tab appears alongside the inviter's, with read-only visibility both ways
5. **Updating income**: Settings → Income → edit manually → take-home recalculates → historical months are unaffected (income changes apply going forward)
6. **New month rollover**: on entering a new month, each category's goal carries forward from the prior month automatically; the user only edits categories whose goal actually changed

## 8. Non-Functional Requirements

- **Mobile-first responsive web** — most entries will happen on a phone, in the moment
- Entry flow must work well with a thumb, minimal taps, large touch targets
- No linking of any external financial accounts, by design — this should be stated somewhere in-product (e.g. onboarding copy) so it's a known, intentional feature, not a missing one
- Data is manually entered and should be easy to export (CSV export of raw transactions is reasonable to include, since it's the user's own typed-in data, not an import feature)
- Fast perceived performance on the "add entry" flow specifically — this is the highest-frequency action in the app

## 9. Resolved Decisions

- **Paystub upload**: manual entry only for v1. No OCR/auto-parse — ship the manual income form (already prototyped) and revisit OCR as a fast-follow once core flows are validated.
- **Monthly category goals**: roll over automatically. A new month inherits the previous month's goal per category; the user edits only when something changes, rather than re-entering every month.
- **Household aggregate view**: shows combined spending **and** combined take-home income (e.g. whole-household savings rate), not spending alone. Per-member income remains visible only within that member's own tab/data, but the Household roll-up sums it.
- **Currency/locale**: USD only for v1. No multi-currency or locale switching.

## 10. Success Metrics

- % of days in a month with at least one manual entry (engagement/habit signal)
- Average time to complete a single entry (should trend down / stay low)
- % of categories with a goal set and % of months ending within goal
- Household invite acceptance rate (if shared households ship)
