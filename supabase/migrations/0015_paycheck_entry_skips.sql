-- Let someone delete one generated payroll savings entry without touching the
-- paycheck that produced it.
--
-- Deleting the transaction row on its own isn't enough: that row IS the
-- idempotency guard (the unique `(income_deduction_id, date)` index from 0011),
-- so generate_paycheck_entries() would post it right back the next time it runs
-- for that date — on a hand backfill, or on the payday itself if the delete
-- happens before the 09:00 UTC cron. The skip row is the tombstone that
-- outlives the transaction.
--
-- Deliberately scoped to one (deduction, date) pair: nothing here writes to
-- income_sources or income_deductions, so the deduction keeps its amount and
-- every other payday still generates as before.

create table if not exists paycheck_entry_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  income_deduction_id uuid not null references income_deductions (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (income_deduction_id, date)
);

comment on table paycheck_entry_skips is
  'One row per payroll auto-entry its owner deleted by hand. Keyed to a single pay date so generate_paycheck_entries() leaves that date alone and no other payday changes.';

alter table paycheck_entry_skips enable row level security;

-- Breaks from the household read pattern on purpose: a skip is a private note
-- to the generator, and nothing in the app reads someone else's. The WITH CHECK
-- also pins the deduction to the caller — without it, a household member could
-- insert a skip against a sibling's deduction and silently suppress *their*
-- savings entry.
create policy "write own paycheck entry skips" on paycheck_entry_skips
  for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from income_deductions d
      join income_sources s on s.id = d.income_source_id
      where d.id = paycheck_entry_skips.income_deduction_id
        and s.user_id = auth.uid()
    )
  );

-- Delete the entry and write its tombstone in one transaction, so a half-done
-- delete can't leave a skip behind for a row that's still there (or vice versa).
-- SECURITY INVOKER: the caller's own RLS decides what they may delete.
create or replace function delete_paycheck_entry(p_transaction_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  tx record;
begin
  select id, user_id, date, income_deduction_id
    into tx
    from transactions
   where id = p_transaction_id
     and user_id = auth.uid()
     and source = 'auto'
     and income_deduction_id is not null;

  if not found then
    raise exception 'No payroll entry of yours with id %', p_transaction_id
      using errcode = '42501';
  end if;

  insert into paycheck_entry_skips (user_id, income_deduction_id, date)
  values (tx.user_id, tx.income_deduction_id, tx.date)
  on conflict (income_deduction_id, date) do nothing;

  delete from transactions where id = tx.id;
end;
$$;

comment on function delete_paycheck_entry is
  'Removes one generated payroll savings entry and records a skip so it is not regenerated. Affects that pay date only — the income source and its deductions are untouched.';

revoke execute on function delete_paycheck_entry(uuid) from public, anon;
grant execute on function delete_paycheck_entry(uuid) to authenticated;

-- The generator now honours those tombstones. Everything else is unchanged
-- from 0012.
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
          and not exists (
            select 1 from paycheck_entry_skips s
            where s.income_deduction_id = income_deductions.id
              and s.date = as_of
          )
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
  'Run daily. Posts a Savings transaction for each retirement-tagged paycheck deduction whose income source is paid on as_of, skipping any (deduction, date) the owner deleted by hand. Idempotent via the unique (income_deduction_id, date) index.';

-- Unrelated to the delete, but caught by the security advisor while this
-- function was open: 0012 left generate_paycheck_entries() reachable at
-- /rest/v1/rpc/generate_paycheck_entries by anon and authenticated. It is
-- SECURITY DEFINER and loops over *every* income source, so any caller could
-- post entries across the whole instance for a date of their choosing. Nothing
-- in the client calls it; the pg_cron job from 0013 runs as the owner and is
-- unaffected. Same reasoning as 0007.
revoke execute on function generate_paycheck_entries(date) from public, anon, authenticated;
