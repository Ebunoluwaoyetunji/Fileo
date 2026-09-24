-- Two follow-ups to statement reading:
--
-- 1. Flagged transactions only need answers where the AI-suggested amount is
--    being used. If the user typed their own amount for a platform (source
--    'manual'), its flagged items no longer appear in "what's missing" or
--    block submitting. The app applies the same rule to Income Summary's
--    Continue button.
--
-- 2. Automatic bank pulls don't exist yet. Until they do, a bank account is
--    treated like any other income source: its statement must be uploaded
--    (the AI can read it) and the user enters or confirms the amount. So
--    auto_pull_platforms is emptied, and "what's missing" asks for every
--    platform's statement. The table stays for when real bank connections
--    arrive.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. What's missing (unchanged from 20260927090000 apart from the flagged rule)
-- ---------------------------------------------------------------------------
create or replace function public.filing_missing_items_for(p_filing_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select id, current_step, income_confirmed_at, tax_year from public.filings where id = p_filing_id
  ),
  rules as (
    select r.params from f, public.tax_rules_for_year(f.tax_year) r
  ),
  sources as (
    select s.platform, s.amount_kobo, s.amount_source, s.position
      from public.filing_income_sources s
     where s.filing_id = p_filing_id
  ),
  claimable as (
    -- Deductions this tax year allows (a claim it doesn't allow, like rent on
    -- a 2025 return, is simply not applied — nothing to supply for it).
    select x.deduction_type, x.amount_paid_kobo
      from public.filing_deductions x, rules
     where x.filing_id = p_filing_id
       and coalesce((rules.params -> 'reliefs' -> x.deduction_type ->> 'allowed')::boolean, false)
  ),
  flagged as (
    -- Unanswered flagged transactions in each platform's statement — only
    -- where the AI's amount is being used. If the user typed their own
    -- amount (source 'manual'), the answers wouldn't change their return.
    select s.platform, s.position, count(*) as remaining
      from sources s
      join public.filing_documents fd
        on fd.filing_id = p_filing_id and fd.slot = 'platform:' || s.platform
      join public.document_extractions e
        on e.document_id = fd.document_id and e.status = 'done'
      join public.extracted_transactions t
        on t.extraction_id = e.id and t.needs_review and t.user_decision is null
     where s.amount_source is distinct from 'manual'
     group by s.platform, s.position
  ),
  items as (
    select 0 as step, 0 as pos, 0 as sub,
           jsonb_build_object('type', 'income_sources') as item
     where not exists (select 1 from sources)
    union all
    select 1, s.position, 0, jsonb_build_object('type', 'income_amount', 'platform', s.platform)
      from sources s
     where s.amount_kobo is null
    union all
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
    select 2, fl.position, 0,
           jsonb_build_object('type', 'flagged_transactions', 'platform', fl.platform,
                              'count', fl.remaining)
      from flagged fl
    union all
    select 2, s.position, 1, jsonb_build_object('type', 'ai_amount_unconfirmed', 'platform', s.platform)
      from sources s, f
     where f.income_confirmed_at is null
       and s.amount_source = 'ai'
       and s.amount_kobo is not null
    union all
    select 2, 1000, 0, jsonb_build_object('type', 'income_unconfirmed')
      from f
     where f.income_confirmed_at is null
       and exists (select 1 from sources)
       and not exists (select 1 from sources s where s.amount_source = 'ai' and s.amount_kobo is not null)
    union all
    select 3,
           array_position(array['rent', 'life_assurance', 'pension', 'nhf'], c.deduction_type),
           0,
           jsonb_build_object('type', 'deduction_amount', 'deduction_type', c.deduction_type)
      from claimable c
     where c.amount_paid_kobo is null
    union all
    select 3,
           array_position(array['rent', 'life_assurance', 'pension', 'nhf'], c.deduction_type),
           1,
           jsonb_build_object('type', 'deduction_document', 'deduction_type', c.deduction_type)
      from claimable c
     where not exists (
         select 1 from public.filing_documents d
          where d.filing_id = p_filing_id
            and d.slot = 'deduction:' || c.deduction_type
            and d.document_id is not null
       )
    union all
    select 4, 0, 0, jsonb_build_object('type', 'review')
      from f
     where f.current_step <> 'return_review'
  )
  select coalesce(jsonb_agg(item order by step, pos, sub), '[]'::jsonb) from items;
$$;

revoke all on function public.filing_missing_items_for(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. No bank is auto-pulled yet
-- ---------------------------------------------------------------------------
delete from public.auto_pull_platforms;
