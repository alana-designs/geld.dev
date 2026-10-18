-- Google sign-in gives us a real first name; use it instead of the email's
-- local part when someone signs up that way.
--
-- This only ever runs on INSERT into auth.users, i.e. for brand-new accounts.
-- An existing magic-link user who signs in with Google for the first time is
-- *linked* to their existing auth.users row rather than inserted, so this
-- trigger does not fire for them and their profile (name, household, history)
-- is left exactly as it is.
--
-- BASED ON THE LIVE DEFINITION, NOT 0001. The version of handle_new_user() in
-- 0001 still had the "join whichever household has a pending invite for this
-- email" branch; 0005 deleted that branch deliberately, because it let a
-- stranger's signup be captured by anyone who had inserted an invite for their
-- address. Signup gets a household of one, unconditionally -- joining is
-- accept_household_invite() plus the inviter's confirmation, and nothing here
-- may shortcut it. The only change below is which expression supplies `name`.

-- Prefer Google's given_name, fall back to the first word of a full name, then
-- to the part of the email before the @ — which is what every account created
-- so far was named after.
create or replace function signup_display_name(meta jsonb, email text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(trim(meta ->> 'given_name'), ''),
    nullif(split_part(trim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ' ', 1), ''),
    split_part(email, '@', 1)
  );
$$;

revoke execute on function signup_display_name(jsonb, text) from public, anon, authenticated;

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
  values (
    new.id,
    new_household_id,
    signup_display_name(new.raw_user_meta_data, new.email),
    new.email,
    '#38352f'
  );
  return new;
end;
$$;

-- Same posture as 0005/0007: trigger execution doesn't consult EXECUTE, so this
-- only closes the /rest/v1/rpc surface.
revoke execute on function handle_new_user() from public, anon, authenticated;
