-- Hourly income sources have no fixed pay frequency — each paycheck is
-- logged manually as it arrives, dated with when it was actually received.
-- `frequency` is only required for salaried sources; hourly sources use
-- `paycheck_date` instead, and contribute to whichever month that date
-- falls in (see monthlyNet() in src/utils/income.ts) rather than a
-- recurring monthly rate. They also never generate the auto-savings
-- projections salaried retirement deductions do — there's no fixed
-- schedule to project from.
alter table income_sources
  add column pay_type text not null default 'salaried' check (pay_type in ('salaried', 'hourly'));

alter table income_sources alter column frequency drop not null;

alter table income_sources add column paycheck_date date;

alter table income_sources
  add constraint income_sources_frequency_required_for_salaried
  check (pay_type = 'hourly' or frequency is not null);

alter table income_sources
  add constraint income_sources_paycheck_date_required_for_hourly
  check (pay_type = 'salaried' or paycheck_date is not null);
