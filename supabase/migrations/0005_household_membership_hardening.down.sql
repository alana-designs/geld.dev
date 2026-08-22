-- Rollback for 0005_household_membership_hardening.sql.
--
-- Not applied automatically -- there is no migration runner on this project;
-- 0005 was applied directly. Run this by hand only to restore pre-0005
-- behavior, and understand that doing so reopens both holes 0005 closed:
-- household_id becomes client-writable again, and signup silently joins any
-- household holding a pending invite for the new user's email.
--
-- Membership moved by accept_household_invite() is NOT reverted -- profiles and
-- their categories/transactions/income stay in the household they joined.

drop policy if exists "read household invites" on household_invites;
drop policy if exists "read invites addressed to me" on household_invites;
drop policy if exists "create invites in own household" on household_invites;
drop policy if exists "delete own household invites" on household_invites;

create policy "manage own household's invites" on household_invites
  for all using (household_id = my_household_id())
  with check (household_id = my_household_id());

drop function if exists accept_household_invite(uuid);
drop function if exists my_email();

grant update on profiles to authenticated, anon;
grant update on transactions to authenticated, anon;
grant update on categories to authenticated, anon;
grant update on household_invites to authenticated, anon;

grant execute on function handle_new_user() to public;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite household_invites%rowtype;
  new_household_id uuid;
begin
  select * into invite
  from household_invites
  where email = new.email and status = 'pending'
  order by created_at asc
  limit 1;

  if found then
    update household_invites set status = 'accepted' where id = invite.id;
    insert into profiles (id, household_id, name, email, color)
    values (new.id, invite.household_id, coalesce(invite.name, split_part(new.email, '@', 1)), new.email, invite.color);
  else
    insert into households default values returning id into new_household_id;
    insert into profiles (id, household_id, name, email, color)
    values (new.id, new_household_id, split_part(new.email, '@', 1), new.email, '#38352f');
  end if;

  return new;
end;
$$;
