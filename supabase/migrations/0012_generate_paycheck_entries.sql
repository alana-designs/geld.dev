-- Posts a Savings transaction for each retirement-tagged paycheck deduction
-- whose income source is paid on `as_of`. Replaces the client-side
-- generateAutoEntries() projection that used to compute these live per viewed
-- month — these are now real rows.
--
-- APPLIED OUT-OF-BAND on 2026-08-31 as `create_generate_paycheck_entries_function`.
--
-- Two behaviors worth knowing:
--   * It only ever writes for `as_of`. There is no backfill — months before
--     the job existed have no auto entries unless it is called for those dates.
--   * A deduction with no category_id is skipped entirely. The old client
--     projection instead fell back to the first unarchived Savings category.
create or replace function generate_paycheck_entries(as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
  src record;
  ded record;
  pay_days integer[];
  last_day integer;
  rows_affected integer;
begin
  last_day := extract(day from (date_trunc('month', as_of) + interval '1 month - 1 day'))::integer;

  for src in select * from income_sources loop
    if src.frequency = 'semimonthly' then
      if src.semimonthly_schedule = '15th_last' then
        pay_days := array[15, last_day];
      else
        pay_days := array[1, 15]; -- default, also covers '1st_15th'
      end if;
    elsif src.frequency = 'monthly' then
      pay_days := array[last_day];
    elsif src.frequency = 'biweekly' then
      pay_days := array[14, 28];
    elsif src.frequency = 'weekly' then
      pay_days := array[7, 14, 21, 28];
    else
      -- Hourly sources have frequency null: nothing to project.
      pay_days := array[]::integer[];
    end if;

    if extract(day from as_of)::integer = any (pay_days) then
      for ded in
        select * from income_deductions
        where income_source_id = src.id
          and tag = 'retirement'
          and category_id is not null
          and amount > 0
      loop
        insert into transactions
          (user_id, household_id, category_id, amount, description, date, recurring, source, income_deduction_id)
        values
          (src.user_id, src.household_id, ded.category_id, ded.amount,
           ded.label || ' — ' || src.name, as_of, false, 'auto', ded.id)
        on conflict (income_deduction_id, date) where income_deduction_id is not null
        do nothing;

        get diagnostics rows_affected = row_count;
        inserted_count := inserted_count + rows_affected;
      end loop;
    end if;
  end loop;

  return inserted_count;
end;
$$;

comment on function generate_paycheck_entries is
  'Run daily. Posts a Savings transaction for each retirement-tagged paycheck deduction whose income source is paid on as_of. Idempotent via the unique (income_deduction_id, date) index.';
