-- Server-side identity verification (BVN + NIN).
--
-- Before this migration the app marked the user verified itself, which any
-- signed-in user could do by sending their own update. From now on only the
-- verify-identity Edge Function (running with the service role) can change
-- the identity columns. Users can still edit their other profile fields.
--
-- Safe to run more than once, so it works whether it's pasted into the
-- dashboard's SQL Editor or applied with `supabase db push`.

-- ---------------------------------------------------------------------------
-- 1. New columns on profiles
-- ---------------------------------------------------------------------------
-- A user is verified once BOTH their NIN and BVN have passed. These four
-- columns describe the check that completed verification; the result of
-- every individual check is kept in identity_verification_attempts below.
alter table public.profiles
  add column if not exists identity_verified_at timestamptz,
  add column if not exists identity_check_type  text,
  add column if not exists identity_provider    text,
  add column if not exists identity_reference   text;

alter table public.profiles drop constraint if exists identity_check_type_valid;
alter table public.profiles
  add constraint identity_check_type_valid
  check (identity_check_type is null or identity_check_type in ('bvn', 'nin'));

-- bvn_masked / nin_masked already only accept "*******1234" (7 asterisks +
-- last 4 digits) through the bvn_masked_format / nin_masked_format
-- constraints from the original profiles setup. Nothing changes there.

-- ---------------------------------------------------------------------------
-- 2. Lock the identity columns
-- ---------------------------------------------------------------------------
-- Requests from the app run as the "authenticated" role (or "anon" when
-- signed out). The Edge Function's secret key runs as "service_role", and the
-- dashboard's SQL Editor runs as "postgres"; both are allowed through.
--
-- Deliberately NOT "security definer": current_user must be the caller's
-- role, not the function owner's, for this check to mean anything.
create or replace function public.protect_identity_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.identity_verified    is distinct from old.identity_verified
    or new.identity_verified_at is distinct from old.identity_verified_at
    or new.identity_check_type  is distinct from old.identity_check_type
    or new.identity_provider    is distinct from old.identity_provider
    or new.identity_reference   is distinct from old.identity_reference
    or new.bvn_masked           is distinct from old.bvn_masked
    or new.nin_masked           is distinct from old.nin_masked
  ) then
    raise exception 'Identity verification fields can only be changed by the server.'
      using errcode = '42501'; -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists protect_identity_columns on public.profiles;
create trigger protect_identity_columns
  before update on public.profiles
  for each row execute function public.protect_identity_columns();

-- ---------------------------------------------------------------------------
-- 3. Log of every verification attempt
-- ---------------------------------------------------------------------------
-- Written only by the Edge Function (service role). Also what the 5-per-24h
-- rate limit counts. Stores the masked number only, never the raw one.
create table if not exists public.identity_verification_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  check_type         text not null check (check_type in ('bvn', 'nin')),
  masked_number      text not null check (masked_number ~ '^\*{7}[0-9]{4}$'),
  result             text not null check (result in ('verified', 'mismatch', 'not_found', 'error')),
  provider           text not null,
  provider_reference text,
  created_at         timestamptz not null default now()
);

-- The rate limit looks up "this user's attempts in the last 24 hours".
create index if not exists identity_verification_attempts_user_created_idx
  on public.identity_verification_attempts (user_id, created_at desc);

alter table public.identity_verification_attempts enable row level security;

drop policy if exists "Users can read their own verification attempts"
  on public.identity_verification_attempts;
create policy "Users can read their own verification attempts"
  on public.identity_verification_attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policies, so RLS already blocks app writes. The
-- grants are removed too, so it stays blocked even if a policy is ever
-- added by mistake. The service role keeps full access.
revoke all on public.identity_verification_attempts from anon;
revoke insert, update, delete, truncate on public.identity_verification_attempts from authenticated;
