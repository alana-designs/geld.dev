-- Let someone correct one generated payroll entry whose real paycheck came in
-- different from what the deduction said — and decide, right there, whether
-- that correction is a one-off or the new normal.
--
-- Why this needs more than a plain update:
--
--   * "Just this paycheck" already survives regeneration for free. The
--     transaction row IS the idempotency guard (the unique
--     `(income_deduction_id, date)` index from 0011) and
--     generate_paycheck_entries() inserts with ON CONFLICT DO NOTHING, so an
--     edited row is never overwritten. What it does NOT have is a way to tell
--     a corrected entry from a generated one — hence `overridden_at`.
--
--   * "This and all future" is two writes in two tables: the deduction (what
--     every later payday is generated from) and this entry. Same reasoning as
--     delete_paycheck_entry() in 0015 — a half-done change that moved the
--     deduction but not the entry, or the reverse, would quietly misstate
--     either the ledger or next month's net pay.
--
-- What neither scope ever does is reach backwards. Editing a deduction has
-- never rewritten entries already posted (saveIncomeSource() touches
-- income_deductions only), and `date > tx.date` keeps it that way here.

alter table transactions
  add column if not exists overridden_at timestamptz;

comment on column transactions.overridden_at is
  'Set when the owner corrected a source = auto entry by hand. Marks the row as deliberately different from what the deduction would have generated, so a later carry-forward leaves it alone and the UI can label it.';

-- Note what is deliberately NOT here: a column grant. `authenticated` holds
-- UPDATE on transactions one column at a time —
-- (amount, category_id, date, description, recurring) — and Postgres does not
-- extend a column grant to a column added later. Leaving `overridden_at` out
-- of that set is the point: "this entry was corrected by hand" is a fact the
-- server records, not a flag a client can set on a row to make a later
-- carry-forward skip it.
--
-- Which is why this one is SECURITY DEFINER where delete_paycheck_entry() is
-- INVOKER: it has to write a column the caller cannot. That means RLS is not
-- doing the scoping any more, so every write below is keyed to the owner of
-- the transaction that was passed in, and that transaction is found by
-- auth.uid() — a caller reaches nothing they do not already own. The
-- deduction's ownership is re-checked rather than inferred, even though
-- income_deduction_id is itself a column no client can write.
create or replace function override_paycheck_entry(
  p_transaction_id uuid,
  p_amount numeric,
  p_category_id uuid,
  p_apply_to_future boolean default false
)
returns setof transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  tx record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to edit a paycheck entry'
      using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'A paycheck entry needs an amount above zero'
      using errcode = '22023';
  end if;

  select id, user_id, date, income_deduction_id
    into tx
    from transactions
   where id = p_transaction_id
     and user_id = auth.uid()
     and source = 'auto';

  if not found then
    raise exception 'No payroll entry of yours with id %', p_transaction_id
      using errcode = '42501';
  end if;

  -- A payroll deduction can only ever land in one of your own Savings
  -- buckets — that is the invariant generate_paycheck_entries() is built on,
  -- and the only thing the picker offers. Checked here so the RPC cannot be
  -- used to file payroll savings under Needs or Wants, or under someone
  -- else's category.
  if not exists (
    select 1
      from categories c
     where c.id = p_category_id
       and c.user_id = tx.user_id
       and c.parent = 'Savings'
  ) then
    raise exception 'Category % is not one of your Savings categories', p_category_id
      using errcode = '42501';
  end if;

  if p_apply_to_future then
    -- An orphaned entry (0016 nulls this link when the deduction is deleted)
    -- has no future to carry anything into. The caller should have offered
    -- "just this paycheck" only; say so rather than silently doing half.
    if tx.income_deduction_id is null then
      raise exception 'That entry is no longer linked to a paycheck deduction, so there is nothing to carry forward'
        using errcode = '42809';
    end if;

    if not exists (
      select 1
        from income_deductions d
        join income_sources s on s.id = d.income_source_id
       where d.id = tx.income_deduction_id
         and s.user_id = tx.user_id
    ) then
      raise exception 'That deduction is not yours'
        using errcode = '42501';
    end if;

    update income_deductions
       set amount = p_amount,
           category_id = p_category_id
     where id = tx.income_deduction_id;

    -- Entries already posted for a *later* pay date follow along — unless one
    -- carries an override of its own, which was a deliberate statement about
    -- that single paycheck and outranks a blanket carry-forward.
    return query
      update transactions
         set amount = p_amount,
             category_id = p_category_id
       where income_deduction_id = tx.income_deduction_id
         and user_id = tx.user_id
         and source = 'auto'
         and date > tx.date
         and overridden_at is null
      returning *;
  end if;

  -- The edited entry itself, last, so it wins if it somehow matched above.
  return query
    update transactions
       set amount = p_amount,
           category_id = p_category_id,
           overridden_at = now()
     where id = tx.id
    returning *;
end;
$$;

comment on function override_paycheck_entry is
  'Corrects one generated payroll entry. With p_apply_to_future, also updates the deduction behind it so every later payday is generated at the new amount, and carries the change into any already-posted later entry that has not been overridden itself. Never touches an earlier pay date.';

revoke execute on function override_paycheck_entry(uuid, numeric, uuid, boolean) from public, anon;
grant execute on function override_paycheck_entry(uuid, numeric, uuid, boolean) to authenticated;
