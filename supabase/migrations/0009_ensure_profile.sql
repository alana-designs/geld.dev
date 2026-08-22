-- Self-heal for an auth user that has no profile row.
--
-- handle_new_user() fires only on INSERT into auth.users, so it never backfills
-- an existing account. If a profile row is ever removed while its auth user
-- survives -- deleting from the Table Editor instead of Authentication -> Users
-- does exactly this -- that account is permanently stuck: the load path does
-- .single() on a missing row, errors, and the app sits on a blank screen with
-- no way back. Two test accounts hit this on 2026-08-22.
--
-- The client calls this when the profile fetch comes back empty. It is
-- idempotent: an existing profile is returned untouched.

create function ensure_profile()
returns profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_household uuid;
  result profiles;
begin
  if v_user_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into result from profiles where id = v_user_id;
  if found then
    return result;
  end if;

  -- Serialize per user for the rest of the transaction. Without this, two
  -- concurrent calls (two tabs opening at once) would each create a household
  -- and one would be left empty and unreferenced.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  -- Re-check: the call we queued behind may have just created it.
  select * into result from profiles where id = v_user_id;
  if found then
    return result;
  end if;

  select email into v_email from auth.users where id = v_user_id;
  if v_email is null then
    raise exception 'No account for this session' using errcode = '42501';
  end if;

  -- A household of one, exactly as a fresh signup gets. Deliberately does NOT
  -- try to restore prior membership: whatever household they were in, their
  -- rows went with the deleted profile, and rejoining is an invite away.
  insert into households default values returning id into v_household;

  insert into profiles (id, household_id, name, email, color)
  values (v_user_id, v_household, split_part(v_email, '@', 1), v_email, '#38352f');

  select * into result from profiles where id = v_user_id;
  return result;
end;
$$;

revoke execute on function ensure_profile() from public, anon;
grant execute on function ensure_profile() to authenticated;
