-- Semimonthly paychecks land on one of two common patterns — the 1st & 15th,
-- or the 15th & the last day of the month. Which one matters for more than
-- labeling: it decides the dates auto-savings entries post on.
--
-- APPLIED OUT-OF-BAND on 2026-08-31 as `add_semimonthly_schedule_option`,
-- ahead of this file. Written idempotently so it is a no-op against that
-- database and still correct against a fresh one.
alter table income_sources
  add column if not exists semimonthly_schedule text
  check (semimonthly_schedule in ('1st_15th', '15th_last'));

comment on column income_sources.semimonthly_schedule is
  'Only used when frequency = semimonthly. Determines which two calendar dates paychecks land on.';
