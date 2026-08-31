-- Distinguish auto-generated paycheck entries from manually typed ones, and
-- link each auto entry back to the deduction that produced it.
--
-- APPLIED OUT-OF-BAND on 2026-08-31 as `add_transaction_source_tracking`.
-- Transcribed here so supabase/migrations/ stays the authoritative record.
--
-- This is the schema half of moving payroll auto-savings from a client-side
-- projection to real, server-generated rows — see 0012 and 0013.
alter table transactions
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto')),
  add column if not exists income_deduction_id uuid
    references income_deductions (id) on delete cascade;

comment on column transactions.source is
  'manual = typed in by the user. auto = generated from a tagged paycheck deduction.';
comment on column transactions.income_deduction_id is
  'Set only when source = auto. The deduction that generated this entry.';

-- Idempotency for the daily generation job: one entry per deduction per date.
create unique index if not exists transactions_income_deduction_date_idx
  on transactions (income_deduction_id, date)
  where income_deduction_id is not null;
