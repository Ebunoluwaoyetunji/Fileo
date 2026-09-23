-- Keep profiles.email in sync with the login email, and stop the app from
-- changing it directly.
--
-- The login email lives in auth.users and only changes once Supabase Auth
-- has confirmed an email change (with "Secure email change" on: after both
-- the old and the new address have confirmed). A trigger on auth.users
-- copies it into profiles at that moment, on the server, so the two can't
-- drift apart and the app never has to write it.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Sync auth.users.email -> profiles.email
-- ---------------------------------------------------------------------------
-- security definer: runs as the function owner, which is what lets it
-- update profiles when Supabase Auth changes auth.users (and what lets it
-- past the lock in step 2).
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- 2. Lock profiles.email
-- ---------------------------------------------------------------------------
-- Same approach as protect_identity_columns: requests from the app run as
-- "authenticated" (or "anon") and are rejected. The sync trigger above
-- (security definer), the service role and the SQL Editor pass.
-- Deliberately NOT security definer, so current_user is the caller's role.
create or replace function public.protect_profile_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.email is distinct from old.email then
    raise exception 'Email can only be changed by confirming the new address.'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_email on public.profiles;
create trigger protect_profile_email
  before update on public.profiles
  for each row execute function public.protect_profile_email();

-- ---------------------------------------------------------------------------
-- 3. One-time catch-up
-- ---------------------------------------------------------------------------
-- Fix any profile whose email already differs from the login email (e.g.
-- if it was edited before this lock existed).
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;
