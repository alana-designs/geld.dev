-- Runs generate_paycheck_entries() every morning at 09:00 UTC.
--
-- APPLIED OUT-OF-BAND on 2026-08-31 as `schedule_daily_paycheck_generation`.
--
-- NOTE: this contradicts the "no cron job — all computed live per viewed
-- month" note that KNOWLEDGE.md carried before 2026-08-31. Payroll auto-
-- savings are now materialized server-side; recurring *expenses*
-- (src/utils/recurring.ts) are still projected client-side and always were.
create extension if not exists pg_cron;

select cron.schedule(
  'generate-paycheck-entries-daily',
  '0 9 * * *',
  $$select public.generate_paycheck_entries();$$
);
