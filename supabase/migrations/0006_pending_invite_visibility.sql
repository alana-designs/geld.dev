-- Lets an invitee see who is inviting them, and decline.
--
-- 0005 made joining a household an explicit act, but an invitee can't read the
-- inviter's profile -- profiles are readable only within your own household, and
-- the whole point is that the invitee isn't in it yet. Without this they'd be
-- asked to hand over their financial history to an anonymous household id.
--
-- Discloses the inviter's name and email, and how many people are already in
-- the household, only to someone holding a pending invite at their own
-- confirmed address. That's the minimum needed to make the choice informed.

create function my_pending_invites()
returns table (
  invite_id uuid,
  inviter_name text,
  inviter_email text,
  household_size bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    i.id,
    p.name,
    p.email,
    (select count(*) from profiles m where m.household_id = i.household_id)
  from household_invites i
  join profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and lower(i.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    and i.household_id is distinct from (select s.household_id from profiles s where s.id = auth.uid())
  order by i.created_at asc
$$;

revoke execute on function my_pending_invites() from public;
grant execute on function my_pending_invites() to authenticated;

-- Declining. The 0005 policy only let a household delete its own outgoing
-- invites, which left the invitee unable to clear one addressed to them.
drop policy "delete own household invites" on household_invites;

create policy "delete invites you sent or received" on household_invites
  for delete to authenticated
  using (
    household_id = my_household_id()
    or lower(email) = lower(my_email())
  );
