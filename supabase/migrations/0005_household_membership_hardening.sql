-- Household membership hardening.
--
-- Fixes two ways one user could reach another user's data:
--
--   1. `profiles.household_id` was writable by its owner. Every read policy in
--      the schema resolves through `my_household_id()`, which reads that column,
--      so rewriting it moved the caller into any household whose id they knew --
--      and the id is returned to every member on every page load.
--
--   2. `handle_new_user()` silently placed a new signup into whichever household
--      had a pending invite for their email, with no accept step. Anyone could
--      insert an invite for any address, so a stranger's signup could be captured
--      (deliberately, or by an inviter's typo landing on a real address).
--
-- The shape of the fix: membership stops being a column users can write and
-- becomes an operation they can request. `accept_household_invite()` is the only
-- path in, and it requires the caller's own confirmed email to match the invite.
--
-- NOTE ON REVOKES: Postgres ignores a column-level revoke when the role holds a
-- table-level grant ("revoking the same privileges from individual columns will
-- have no effect"). Supabase grants UPDATE at the table level, so each block
-- below drops the table grant first, then re-grants only the safe columns.

-- ---------------------------------------------------------------------------
-- 1. Authoritative identity helper
-- ---------------------------------------------------------------------------

-- The caller's email straight from auth.users, so membership checks never
-- depend on profiles.email (which its owner can still edit).
create function my_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select email from auth.users where id = auth.uid()
$$;

revoke execute on function my_email() from public;
grant execute on function my_email() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Take the authorization columns away from clients
-- ---------------------------------------------------------------------------

-- household_id is the key the whole read model resolves through; id and email
-- are identity. None of them are the user's to rewrite. name/color/onboarded
-- are the only columns the app actually updates.
revoke update on profiles from authenticated, anon;
grant update (name, color, onboarded) on profiles to authenticated;

-- Same class of hole on the write side: INSERT pinned household_id to
-- my_household_id(), but UPDATE's WITH CHECK only pinned user_id -- so a user
-- could move their own rows into someone else's household.
revoke update on transactions from authenticated, anon;
grant update (amount, category_id, description, date, recurring) on transactions to authenticated;

revoke update on categories from authenticated, anon;
grant update (name, parent, archived) on categories to authenticated;

-- Invite status is set only by accept_household_invite() below.
revoke update on household_invites from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Signup no longer joins households
-- ---------------------------------------------------------------------------

-- Every signup now gets its own household of one, unconditionally. Joining is
-- a separate, explicit, consented act. This also shrinks what runs inside an
-- auth.users trigger, where a failure blocks all signups.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into households default values returning id into new_household_id;
  insert into profiles (id, household_id, name, email, color)
  values (new.id, new_household_id, split_part(new.email, '@', 1), new.email, '#38352f');
  return new;
end;
$$;

-- Trigger execution doesn't consult EXECUTE privilege, so revoking this only
-- closes the /rest/v1/rpc/handle_new_user surface.
-- NOTE: this revoke is not sufficient on its own -- Supabase grants EXECUTE
-- directly to anon/authenticated, not through PUBLIC. See 0007.
revoke execute on function handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- 4. Joining a household, explicitly
-- ---------------------------------------------------------------------------

-- The only supported way to change household_id. Requires that the invite be
-- addressed to the caller's own confirmed email, which is what makes an invite
-- squatted on someone else's address useless.
--
-- Accepting carries the caller's own categories, transactions and income into
-- the new household -- they'd otherwise vanish from their own view, since every
-- read filters on household_id. Household membership means shared visibility,
-- so the accept UI has to say plainly that existing entries come along.
create function accept_household_invite(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_old_household uuid;
  v_members int;
  inv household_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select email, email_confirmed_at into v_email, v_confirmed
  from auth.users where id = v_user_id;

  if v_confirmed is null then
    raise exception 'Confirm your email address before joining a household'
      using errcode = '42501';
  end if;

  -- Locked to serialize concurrent accepts of the same invite.
  select * into inv
  from household_invites
  where id = p_invite_id
    and status = 'pending'
    and lower(email) = lower(v_email)
  for update;

  if not found then
    raise exception 'That invite is no longer available' using errcode = '42501';
  end if;

  select household_id into v_old_household from profiles where id = v_user_id;

  if inv.household_id = v_old_household then
    update household_invites set status = 'accepted' where id = inv.id;
    return v_old_household;
  end if;

  -- Leaving a shared household would pull this member's history out from under
  -- the people still in it. That needs its own deliberate flow.
  select count(*) into v_members from profiles where household_id = v_old_household;
  if v_members > 1 then
    raise exception 'Leave your current household before joining another'
      using errcode = '42501';
  end if;

  update categories     set household_id = inv.household_id where user_id = v_user_id;
  update transactions   set household_id = inv.household_id where user_id = v_user_id;
  update income_sources set household_id = inv.household_id where user_id = v_user_id;
  update profiles       set household_id = inv.household_id where id = v_user_id;
  update household_invites set status = 'accepted' where id = inv.id;

  -- The vacated household row is deliberately left in place. households cascades
  -- to transactions, so deleting one on the assumption it's empty is a data-loss
  -- bug waiting on a missed reference. An orphaned uuid costs nothing.
  return inv.household_id;
end;
$$;

revoke execute on function accept_household_invite(uuid) from public;
grant execute on function accept_household_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Invite visibility
-- ---------------------------------------------------------------------------

-- Replaces a single FOR ALL policy, which let any member write any column --
-- including marking an invite accepted by hand.
drop policy "manage own household's invites" on household_invites;

create policy "read household invites" on household_invites
  for select to authenticated
  using (household_id = my_household_id());

-- So an invitee can find the invite waiting for them before they've joined.
create policy "read invites addressed to me" on household_invites
  for select to authenticated
  using (lower(email) = lower(my_email()));

create policy "create invites in own household" on household_invites
  for insert to authenticated
  with check (household_id = my_household_id() and invited_by = auth.uid());

create policy "delete own household invites" on household_invites
  for delete to authenticated
  using (household_id = my_household_id());

-- ---------------------------------------------------------------------------
-- 6. Linter hygiene
-- ---------------------------------------------------------------------------

create or replace function goal_for_month(p_category_id uuid, p_month date)
returns numeric
language sql
stable
set search_path = public
as $$
  select amount
  from category_goals
  where category_id = p_category_id
    and effective_month <= date_trunc('month', p_month)::date
  order by effective_month desc
  limit 1
$$;
