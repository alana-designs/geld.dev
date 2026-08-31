-- Pin the pay dates for semimonthly sources that predate the
-- semimonthly_schedule column (0010).
--
-- Both readers — generate_paycheck_entries() and the sheet's picker — treat a
-- NULL schedule as the 1st & 15th. Every existing semimonthly row is NULL, so
-- without this they would silently adopt that pattern. Confirmed with the
-- account holder that the real paychecks land on the 15th and the last day, so
-- the backfill pins that rather than letting the default decide.
update income_sources
  set semimonthly_schedule = '15th_last'
  where frequency = 'semimonthly'
    and semimonthly_schedule is null;

-- Once every row is pinned, stop new ones from being written unpinned, so the
-- NULL-means-1st-&-15th fallback can never quietly own someone's pay dates.
alter table income_sources
  add constraint income_sources_semimonthly_schedule_required_for_semimonthly
  check (frequency is distinct from 'semimonthly' or semimonthly_schedule is not null);
