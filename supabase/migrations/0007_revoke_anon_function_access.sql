-- Close the anon RPC surface on the SECURITY DEFINER helpers.
--
-- 0005/0006 used `revoke execute ... from public`, which was not enough:
-- Supabase grants EXECUTE directly to the `anon` and `authenticated` roles, so
-- dropping the PUBLIC grant left the direct role grants in place and every
-- helper stayed reachable at /rest/v1/rpc/<name> without signing in.
--
-- None of them actually leak anything as anon -- auth.uid() is null, so
-- my_email() returns null, my_pending_invites() matches nothing, and
-- accept_household_invite() raises 'Not signed in'. This is defense in depth,
-- and it makes the surface match what the 0005 comments claim.

revoke execute on function my_email() from anon;
revoke execute on function my_pending_invites() from anon;
revoke execute on function accept_household_invite(uuid) from anon;
revoke execute on function handle_new_user() from anon, authenticated;

-- my_household_id() deliberately keeps its anon grant. The table policies from
-- 0001 are still scoped `to public`, so an unauthenticated request evaluates
-- them; without EXECUTE that turns a clean empty result into a "permission
-- denied for function" error. Revoke this only as part of re-scoping those
-- policies to `authenticated`, which is a separate change.
