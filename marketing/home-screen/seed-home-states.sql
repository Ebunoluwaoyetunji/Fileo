-- Made-up filings for the Home screen screenshots. Run against a LOCAL/TEST
-- database only, after the Return Review demo account exists (see
-- ../review-screen/README.md). Every figure here is invented.
--
--   psql ... -v state=in_progress -f marketing/home-screen/seed-home-states.sql
--
-- state:
--   not_started  no filings at all
--   in_progress  the 2025 return from ../review-screen/seed-demo-return.sql,
--                saved at the Deductions step (3 of 5 steps done), plus a
--                filed 2024 return
--   submitted    2025 submitted (being processed), plus a filed 2024 return
--   completed    2025 and 2024 both filed
-- It also names the demo account "Tolu Bakare" (made up) for the greeting.
select set_config('fileo.home_state', :'state', false);

\ir ../review-screen/seed-demo-return.sql

do $$
declare
  u uuid := (select id from auth.users where email = 'demo@example.com');
  state text := current_setting('fileo.home_state');
  f uuid := (select id from public.filings where user_id = u and tax_year = 2025);
begin
  if state not in ('not_started', 'in_progress', 'submitted', 'completed') then
    raise exception 'Unknown state %', state;
  end if;

  update public.profiles set full_name = 'Tolu Bakare' where id = u;

  if state = 'not_started' then
    delete from public.filings where user_id = u;
    delete from public.documents where user_id = u;
    return;
  end if;

  insert into public.filings (user_id, tax_year, status, current_step, reference, submitted_at, created_at)
    values (u, 2024, 'completed', 'return_review', 'FIL-2024-7K3Q9D', '2025-02-18 10:12:00+01', '2025-02-10 09:00:00+01');

  if state = 'in_progress' then
    update public.filings set current_step = 'deductions' where id = f;
  elsif state = 'submitted' then
    update public.filings
       set status = 'submitted', reference = 'FIL-2025-4M8TZP', submitted_at = '2026-02-12 16:40:00+01'
     where id = f;
  else
    update public.filings
       set status = 'completed', reference = 'FIL-2025-4M8TZP', submitted_at = '2026-02-12 16:40:00+01'
     where id = f;
  end if;
end $$;
