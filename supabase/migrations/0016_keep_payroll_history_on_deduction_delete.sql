-- A posted payroll entry is a historical fact. Keep it when the deduction
-- behind it goes away.
--
-- 0011 made transactions.income_deduction_id ON DELETE CASCADE, which was fine
-- as long as a deduction only ever disappeared because its owner deleted it.
-- It didn't stay that way: saveIncomeSource() handled an *edit* by deleting
-- every income_deductions row for the source and re-inserting them with fresh
-- ids, so editing a paycheck silently destroyed every auto entry it had ever
-- generated. That is how the July/August 2026 backfill recorded in
-- KNOWLEDGE.md was lost — zero source = 'auto' rows survived to 2026-10-18.
--
-- The client-side fix (reconcile deductions by id instead of replacing them)
-- is the actual repair. This is the second line of defence: even on a genuine
-- delete, the entries that were already posted stay in the ledger, orphaned
-- but intact, because the money really did leave those paychecks on those
-- dates. Losing the ledger should take a deliberate act, not a side effect.
alter table transactions
  drop constraint transactions_income_deduction_id_fkey,
  add constraint transactions_income_deduction_id_fkey
    foreign key (income_deduction_id) references income_deductions (id)
    on delete set null;

comment on column transactions.income_deduction_id is
  'The deduction that generated this entry. Set when source = auto, then nulled if that deduction is later deleted — the entry survives as history, so a null here does not mean the row was typed in by hand (source does).';

-- What this does NOT disturb:
--
-- * Idempotency. The unique index from 0011 is partial
--   (`where income_deduction_id is not null`), so a nulled row drops straight
--   out of it and generate_paycheck_entries() keeps its one-entry-per-
--   (deduction, date) guarantee over the rows that still have a deduction.
--
-- * delete_paycheck_entry(). It still requires income_deduction_id is not
--   null, which is right: its whole job is writing a (deduction, date)
--   tombstone, and there is nothing to tombstone once the deduction is gone —
--   no deduction means nothing can regenerate the entry either. An orphaned
--   entry is deleted by the ordinary path instead; deleteTransaction() in the
--   client already routes on that column being set, and EntryRow now decides
--   whether to offer the delete from `autoSource` rather than from this link.
--
-- * paycheck_entry_skips stays ON DELETE CASCADE, on purpose. Deduction ids
--   are DB-generated, so an orphaned skip could never match a newly inserted
--   deduction — keeping it would be dead weight, not protection.
--
-- What this DOES change, deliberately: deleting an income source cascades to
-- its deductions, so its past payroll entries now stay in the ledger as
-- orphans instead of being swept up with it. That follows from treating a
-- posted entry as history, but it means deleting a paycheck no longer tidies
-- up after itself, and nothing lists or bulk-deletes orphans yet.
