-- A recurring transaction is the real, manually-logged entry itself; future
-- months project a virtual copy forward on the same day-of-month, computed
-- client-side (see src/utils/recurring.ts) — no stored rows, no cron job.
alter table transactions add column recurring boolean not null default false;
