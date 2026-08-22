-- Mutual-consent membership: expiring invites, a two-sided handshake, and exits.
--
-- 0005 made joining explicit on the invitee's side. This adds the other half:
-- the INVITER confirms the address that actually accepted, so a mistyped invite
-- claimed by a stranger still shares nothing. Invites also expire (1 hour), so a
-- typo can't sit waiting to be claimed indefinitely.
--
-- Status is now a three-step lifecycle:
--   pending   -- sent, nobody has taken it
--   accepted  -- invitee said yes; NOTHING has moved or been shared yet
--   confirmed -- inviter verified the address; the member and their rows moved
--
-- Note the backfill below: under the old model 'accepted' meant the join was
-- DONE, so existing rows migrate to 'confirmed'. Skipping that would show a
-- live household a confirmation prompt for a member who joined months ago.

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------

alter table household_invites
  add column expires_at timestamptz not null default (now() + interval '1 hour'),
  add column accepted_by uuid references profiles (id) on delete set null,
  add column accepted_at timestamptz;

-- Drop the old constraint BEFORE the backfill: it still forbids 'confirmed'.
alter table household_invites drop constraint household_invites_status_check;

update household_invites set status = 'confirmed' where status = 'accepted';

alter table household_invites
  add constraint household_invites_status_check
  check (status in ('pending', 'accepted', 'confirmed'));

-- The old UNIQUE (household_id, email) blocked ever re-inviting someone who had
-- left. Only LIVE invites need to be unique; case-insensitively, since that's
-- how they're matched.
alter table household_invites drop constraint household_invites_household_id_email_key;
create unique index household_invites_live_email_idx
  on household_invites (household_id, lower(email))
  where status in ('pending', 'accepted');

create index household_invites_email_idx on household_invites (lower(email));

-- ---------------------------------------------------------------------------
-- 2. Moving a member (internal)
-- ---------------------------------------------------------------------------

-- Shared by confirm / leave / remove. A member's rows carry household_id, so
-- moving the profile alone would strand their own history outside their view.
-- Not granted to any client role -- it trusts its arguments completely.
create function move_member_to_household(p_user_id uuid, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update categories     set household_id = p_household_id where user_id = p_user_id;
  update transactions   set household_id = p_household_id where user_id = p_user_id;
  update income_sources set household_id = p_household_id where user_id = p_user_id;
  update profiles       set household_id = p_household_id where id = p_user_id;
end;
$$;

revoke execute on function move_member_to_household(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sending an invite
-- ---------------------------------------------------------------------------

-- Inserts go through here rather than the table, so expires_at is set by the
-- server. A client that could write expires_at could write it far enough ahead
-- to make expiry meaningless.
create function send_household_invite(p_email text, p_name text default null)
returns household_invites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_household uuid;
  v_email text := lower(trim(p_email));
  v_color text;
  v_count int;
  row household_invites;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'That doesn''t look like an email address' using errcode = '22023';
  end if;

  select household_id into v_household from profiles where id = v_user_id;

  if exists (select 1 from profiles where household_id = v_household and lower(email) = v_email) then
    raise exception 'They''re already in your household' using errcode = '42501';
  end if;

  -- Clear anything dead for this address so a lapsed invite doesn't block a
  -- fresh one via the live-invite unique index.
  delete from household_invites
  where household_id = v_household
    and lower(email) = v_email
    and (status = 'pending' and expires_at <= now());

  select count(*) into v_count from profiles where household_id = v_household;
  v_color := (array['#8c6239', '#6f7a4a', '#93627e', '#a3562f'])[(v_count % 4) + 1];

  insert into household_invites (household_id, invited_by, email, name, color, expires_at)
  values (v_household, v_user_id, v_email, nullif(trim(coalesce(p_name, '')), ''), v_color,
          now() + interval '1 hour')
  returning * into row;

  return row;
end;
$$;

revoke execute on function send_household_invite(text, text) from public, anon;
grant execute on function send_household_invite(text, text) to authenticated;

-- Sending is the only supported way to create an invite.
revoke insert on household_invites from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4. Accepting (invitee) -- shares nothing on its own
-- ---------------------------------------------------------------------------

create or replace function accept_household_invite(p_invite_id uuid)
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

  select * into inv
  from household_invites
  where id = p_invite_id
    and status = 'pending'
    and lower(email) = lower(v_email)
  for update;

  if not found then
    raise exception 'That invite is no longer available' using errcode = '42501';
  end if;

  if inv.expires_at <= now() then
    raise exception 'That invite expired' using errcode = '42501';
  end if;

  select household_id into v_old_household from profiles where id = v_user_id;

  if inv.household_id = v_old_household then
    raise exception 'You''re already in that household' using errcode = '42501';
  end if;

  select count(*) into v_members from profiles where household_id = v_old_household;
  if v_members > 1 then
    raise exception 'Leave your current household before joining another'
      using errcode = '42501';
  end if;

  -- Records intent only. The move happens in confirm_household_member().
  update household_invites
  set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  where id = inv.id;

  return inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Confirming (inviter) -- the step that actually shares
-- ---------------------------------------------------------------------------

-- Deliberately has no expiry check: the window covers send -> accept, so that a
-- stale invite can't be claimed. Once a real person has accepted, the inviter
-- gets to confirm whenever they next open the app.
create function confirm_household_member(p_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household uuid;
  v_members int;
  inv household_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select household_id into v_household from profiles where id = v_user_id;

  select * into inv
  from household_invites
  where id = p_invite_id
    and status = 'accepted'
    and household_id = v_household
  for update;

  if not found then
    raise exception 'That request is no longer waiting' using errcode = '42501';
  end if;

  if inv.accepted_by is null then
    raise exception 'That request is no longer waiting' using errcode = '42501';
  end if;

  -- They may have joined elsewhere, or gained housemates, since accepting.
  select count(*) into v_members
  from profiles where household_id = (select household_id from profiles where id = inv.accepted_by);
  if v_members > 1 then
    raise exception 'They have since joined another household' using errcode = '42501';
  end if;

  perform move_member_to_household(inv.accepted_by, v_household);
  update household_invites set status = 'confirmed' where id = inv.id;

  return v_household;
end;
$$;

revoke execute on function confirm_household_member(uuid) from public, anon;
grant execute on function confirm_household_member(uuid) to authenticated;

-- Declining. Deletes outright: the invite is spent either way, and keeping a
-- rejected row would block re-inviting the address it was meant for.
create function decline_household_member(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select household_id into v_household from profiles where id = auth.uid();

  delete from household_invites
  where id = p_invite_id and household_id = v_household and status = 'accepted';
end;
$$;

revoke execute on function decline_household_member(uuid) from public, anon;
grant execute on function decline_household_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reading the two queues
-- ---------------------------------------------------------------------------

-- Invitee's side: live invites addressed to me. Now excludes expired ones.
create or replace function my_pending_invites()
returns table (
  invite_id uuid,
  inviter_name text,
  inviter_email text,
  household_size bigint,
  expires_at timestamptz
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
    (select count(*) from profiles m where m.household_id = i.household_id),
    i.expires_at
  from household_invites i
  join profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email) = lower((select u.email from auth.users u where u.id = auth.uid()))
    and i.household_id is distinct from (select s.household_id from profiles s where s.id = auth.uid())
  order by i.created_at asc
$$;

-- Inviter's side: people waiting on my confirmation. Exposes the accepter's
-- name and email -- the inviter can't read their profile (different household),
-- and the address is the whole point of the check.
create function pending_member_confirmations()
returns table (
  invite_id uuid,
  invited_email text,
  accepted_name text,
  accepted_email text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.email,
    p.name,
    p.email,
    i.accepted_at
  from household_invites i
  join profiles p on p.id = i.accepted_by
  where i.status = 'accepted'
    and i.household_id = (select s.household_id from profiles s where s.id = auth.uid())
  order by i.accepted_at asc
$$;

revoke execute on function pending_member_confirmations() from public, anon;
grant execute on function pending_member_confirmations() to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Exits
-- ---------------------------------------------------------------------------

-- Leaving takes your rows with you into a fresh household of one. The vacated
-- household row is left alone -- households cascades to transactions, so
-- deleting one on the assumption it's empty is a data-loss bug waiting to
-- happen.
create function leave_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_old uuid;
  v_members int;
  v_new uuid;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select household_id into v_old from profiles where id = v_user_id;

  select count(*) into v_members from profiles where household_id = v_old;
  if v_members <= 1 then
    raise exception 'You''re not sharing a household with anyone' using errcode = '42501';
  end if;

  insert into households default values returning id into v_new;
  perform move_member_to_household(v_user_id, v_new);

  -- So they can be invited back later.
  delete from household_invites
  where household_id = v_old and lower(email) = lower((select email from profiles where id = v_user_id));

  return v_new;
end;
$$;

revoke execute on function leave_household() from public, anon;
grant execute on function leave_household() to authenticated;

-- Removing is the same move applied to someone else. Any member may remove any
-- other member: this app has no owner/admin role, and a two-person household
-- where only one side can end the sharing would be the wrong default.
create function remove_household_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_household uuid;
  v_new uuid;
begin
  if v_caller is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if p_user_id = v_caller then
    raise exception 'Use leave_household() to remove yourself' using errcode = '42501';
  end if;

  select household_id into v_household from profiles where id = v_caller;

  if not exists (select 1 from profiles where id = p_user_id and household_id = v_household) then
    raise exception 'They''re not in your household' using errcode = '42501';
  end if;

  insert into households default values returning id into v_new;
  perform move_member_to_household(p_user_id, v_new);

  delete from household_invites
  where household_id = v_household and lower(email) = lower((select email from profiles where id = p_user_id));
end;
$$;

revoke execute on function remove_household_member(uuid) from public, anon;
grant execute on function remove_household_member(uuid) to authenticated;
