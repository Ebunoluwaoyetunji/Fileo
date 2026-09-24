-- What's still missing from a draft filing, item by item — one set of rules
-- used both by the app (Return Review, the File tab, the Documents tab ask
-- before anything is submitted) and by submit_filing itself.
--
-- Returns a JSON array, in the order the steps come, e.g.
--   [{"type": "income_amount",      "platform": "Selar"},
--    {"type": "platform_document",  "platform": "Paystack"},
--    {"type": "deduction_document", "deduction_type": "rent"},
--    {"type": "review"}]
-- Item types:
--   income_sources      no platform / bank selected
--   income_amount       a selected source has no confirmed income amount
--   platform_document   a source that isn't an auto-pulled bank has no document
--   deduction_document  a claimed deduction has no supporting document
--   review              the user hasn't confirmed Deductions (reached Return Review)
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- The rules. Not callable by users directly (no ownership check here).
create or replace function public.filing_missing_items_for(p_filing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select id, current_step from public.filings where id = p_filing_id
  ),
  sources as (
    select s.platform, s.amount_kobo, s.position
      from public.filing_income_sources s
     where s.filing_id = p_filing_id
  ),
  items as (
    -- 1. at least one income source
    select 0 as step, 0 as pos, 0 as sub,
           jsonb_build_object('type', 'income_sources') as item
     where not exists (select 1 from sources)
    union all
    -- 2. an income amount for every source
    select 1, s.position, 0, jsonb_build_object('type', 'income_amount', 'platform', s.platform)
      from sources s
     where s.amount_kobo is null
    union all
    -- 3. a document for every source that isn't an auto-pulled bank
    select 1, s.position, 1, jsonb_build_object('type', 'platform_document', 'platform', s.platform)
      from sources s
     where not exists (select 1 from public.auto_pull_platforms a where a.name = s.platform)
       and not exists (
         select 1 from public.filing_documents d
          where d.filing_id = p_filing_id
            and d.slot = 'platform:' || s.platform
            and d.document_id is not null
       )
    union all
    -- 4. a document for every deduction claimed
    select 2,
           array_position(array['rent', 'life_assurance', 'pension', 'nhf'], x.deduction_type),
           0,
           jsonb_build_object('type', 'deduction_document', 'deduction_type', x.deduction_type)
      from public.filing_deductions x
     where x.filing_id = p_filing_id
       and not exists (
         select 1 from public.filing_documents d
          where d.filing_id = p_filing_id
            and d.slot = 'deduction:' || x.deduction_type
            and d.document_id is not null
       )
    union all
    -- 5. every step confirmed, up to Return Review
    select 3, 0, 0, jsonb_build_object('type', 'review')
      from f
     where f.current_step <> 'return_review'
  )
  select coalesce(jsonb_agg(item order by step, pos, sub), '[]'::jsonb) from items;
$$;

revoke all on function public.filing_missing_items_for(uuid) from public, anon, authenticated;

-- For the app: the signed-in user's own draft only.
create or replace function public.get_filing_missing_items(p_filing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.filings f where f.id = p_filing_id and f.user_id = auth.uid()
  ) then
    raise exception 'Filing not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  return public.filing_missing_items_for(p_filing_id);
end;
$$;

revoke all on function public.get_filing_missing_items(uuid) from public, anon;
grant execute on function public.get_filing_missing_items(uuid) to authenticated;

-- submit_filing now uses the same rules, and when it refuses, the error's
-- detail is that same JSON list (hint 'incomplete').
create or replace function public.submit_filing(p_filing_id uuid)
returns table (reference text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_filing public.filings%rowtype;
  v_missing jsonb;
  v_reference text;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into v_filing from public.filings f where f.id = p_filing_id for update;
  -- Same answer for "doesn't exist" and "not yours".
  if not found or v_filing.user_id <> v_user then
    raise exception 'Filing not found' using errcode = 'P0002', hint = 'not_found';
  end if;
  if v_filing.status <> 'draft' then
    raise exception 'This filing has already been submitted' using errcode = 'P0001', hint = 'not_draft';
  end if;

  v_missing := public.filing_missing_items_for(p_filing_id);
  if jsonb_array_length(v_missing) > 0 then
    raise exception 'This filing is missing required steps'
      using errcode = 'P0001', hint = 'incomplete', detail = v_missing::text;
  end if;

  -- e.g. FIL-2025-3F9A1C2B. Retried on the (very unlikely) chance it's taken.
  loop
    v_reference := 'FIL-' || v_filing.tax_year || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.filings f
         set status = 'submitted',
             reference = v_reference,
             submitted_at = v_now
       where f.id = p_filing_id;
      exit;
    exception when unique_violation then
      -- try another reference
    end;
  end loop;

  return query select v_reference, v_now;
end;
$$;

revoke all on function public.submit_filing(uuid) from public, anon;
grant execute on function public.submit_filing(uuid) to authenticated;
