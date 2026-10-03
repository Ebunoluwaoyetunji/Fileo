-- The state a user files in, shown on Return Review (for example "Lagos
-- State", or "Federal Capital Territory"), stored as it should read.
-- Optional: when it is empty the app shows no state at all. Nothing in the
-- app sets it yet; Edit Profile is the place to add it.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

alter table public.profiles add column if not exists state text;

alter table public.profiles drop constraint if exists profiles_state_length;
alter table public.profiles
  add constraint profiles_state_length check (state is null or char_length(state) between 1 and 60);
