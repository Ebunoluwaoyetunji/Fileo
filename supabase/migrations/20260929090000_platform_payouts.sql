-- Stop double counting: platform payouts into a bank account.
--
-- Freelancers are often paid on a platform (Paystack, Upwork, Payoneer,
-- Selar…) and that money is then paid out to their bank. If a filing has
-- both the platform and the bank, the payout would be counted twice. So:
--
--  1. Each transaction read from a statement keeps what the AI said
--     (ai_category) and, if the credit is a payout from a known platform,
--     which one (source_platform).
--  2. The server works out the category used for the return (category):
--     a credit whose source_platform is another platform selected on the
--     same draft becomes 'platform_payout' ("Already counted in
--     Paystack") and doesn't count as income. This depends only on stored
--     data, so when the user adds or removes a platform the categories are
--     re-checked here, without paying to read the file again.
--  3. The user can overrule any transaction (user_decision): a payout
--     "is separate income", or an income item "isn't income". Their answer
--     always wins.
--  4. get_extraction_breakdown() gives the app the per-group list and
--     totals for "See breakdown", worked out here.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Platforms whose payouts we recognise
-- ---------------------------------------------------------------------------
-- Names match the app's platform list (constants/platforms.ts) and the
-- extraction schema (supabase/functions/_shared/extraction/types.ts).
-- pattern: case-insensitive, whole words; used to recognise payouts in
-- transactions read before source_platform existed.
create table if not exists public.payout_platforms (
  name    text primary key,
  pattern text not null
);

insert into public.payout_platforms (name, pattern) values
  ('Paystack', '\mpaystack\M'),
  ('Flutterwave', '\m(flutterwave|flw)\M'),
  ('Upwork', '\mupwork\M'),
  ('Fiverr', '\mfiverr\M'),
  ('Payoneer', '\mpayoneer\M'),
  ('PayPal', '\mpaypal\M'),
  ('Deel', '\mdeel\M'),
  ('Stripe', '\mstripe\M'),
  ('Moniepoint', '\mmoniepoint\M'),
  ('Opay', '\mopay\M'),
  ('PalmPay', '\mpalmpay\M'),
  ('Selar', '\mselar\M'),
  ('YouTube', '\m(youtube|adsense)\M'),
  ('TikTok', '\mtiktok\M'),
  ('Substack', '\msubstack\M'),
  ('Patreon', '\mpatreon\M'),
  ('Instagram', '\minstagram\M')
on conflict (name) do update set pattern = excluded.pattern;

alter table public.payout_platforms enable row level security; -- server only
revoke all on public.payout_platforms from anon, authenticated;

create or replace function public.detect_source_platform(p_description text)
returns text
language sql
stable
set search_path = ''
as $$
  select p.name
    from public.payout_platforms p
   where p_description ~* p.pattern
   order by p.name
   limit 1;
$$;

revoke all on function public.detect_source_platform(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Transactions: what the AI said, where the money came from, and the
--    category the server uses
-- ---------------------------------------------------------------------------
alter table public.extracted_transactions
  add column if not exists ai_category text,
  add column if not exists source_platform text;

-- Rows read before this change: the AI's category is what's stored today,
-- and payouts are recognised from the description.
update public.extracted_transactions
   set ai_category = category
 where ai_category is null;
update public.extracted_transactions
   set source_platform = public.detect_source_platform(description)
 where source_platform is null;

alter table public.extracted_transactions
  alter column ai_category set not null,
  drop constraint if exists extracted_transactions_ai_category_valid,
  add constraint extracted_transactions_ai_category_valid
    check (ai_category in ('income', 'own_transfer', 'refund', 'loan', 'reversal', 'unsure')),
  drop constraint if exists extracted_transactions_category_valid,
  add constraint extracted_transactions_category_valid
    check (category in ('income', 'own_transfer', 'refund', 'loan', 'reversal', 'unsure',
                        'platform_payout')),
  drop constraint if exists extracted_transactions_source_platform_valid,
  add constraint extracted_transactions_source_platform_valid
    foreign key (source_platform) references public.payout_platforms (name) on update cascade,
  -- Any transaction can now be overruled, not just flagged ones.
  drop constraint if exists extracted_transactions_decision_only_when_flagged;

alter table public.document_extractions
  add column if not exists platform_payouts_kobo bigint;

-- ---------------------------------------------------------------------------
-- 3. The suggestion (replaces 20260927090000's version)
-- ---------------------------------------------------------------------------
-- A transaction counts as income, for the document's tax year:
--   - if the user decided: only if they said 'income';
--   - otherwise: if its category is 'income' (not a payout already counted
--     in another platform, not flagged and still unanswered).
-- Also keeps platform_payouts_kobo: payouts left out because they're
-- already counted in another platform on the return.
create or replace function public.recalculate_extraction_suggestion(p_extraction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion bigint;
  v_payouts bigint;
begin
  select case
           when e.status in ('processing', 'done') and e.currency = 'NGN' then
             coalesce(sum(t.amount_kobo) filter (where t.counts), 0)
         end,
         case
           when e.status in ('processing', 'done') then
             coalesce(sum(t.amount_kobo) filter (where t.category = 'platform_payout' and not t.counts), 0)
         end
    into v_suggestion, v_payouts
    from public.document_extractions e
    join public.documents d on d.id = e.document_id
    left join lateral (
      select x.amount_kobo, x.category,
             case when x.user_decision is not null then x.user_decision = 'income'
                  else x.category = 'income' and not x.needs_review end as counts
        from public.extracted_transactions x
       where x.extraction_id = e.id
         and extract(year from x.date) = d.tax_year
    ) t on true
   where e.id = p_extraction_id
   group by e.id, e.status, e.currency;

  update public.document_extractions
     set suggested_income_kobo = v_suggestion,
         platform_payouts_kobo = v_payouts
   where id = p_extraction_id
     and (suggested_income_kobo is distinct from v_suggestion
          or platform_payouts_kobo is distinct from v_payouts);
end;
$$;

revoke all on function public.recalculate_extraction_suggestion(uuid) from public, anon, authenticated;
grant execute on function public.recalculate_extraction_suggestion(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Re-checking categories against the filing's platforms
-- ---------------------------------------------------------------------------
-- The platforms that count as "already on the return" for this statement:
-- every platform selected on the draft(s) that hold it in a platform slot,
-- except the statement's own platform (a Paystack statement's Paystack
-- settlements are its income, not a payout).
create or replace function public.recategorize_extraction(p_extraction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
  v_tax_year smallint;
  v_platforms text[];
begin
  select e.document_id, d.tax_year into v_document_id, v_tax_year
    from public.document_extractions e
    join public.documents d on d.id = e.document_id
   where e.id = p_extraction_id;
  if v_document_id is null or public.is_document_locked(v_document_id) then
    return; -- part of a submitted return: frozen
  end if;

  select coalesce(array_agg(distinct s.platform), '{}')
    into v_platforms
    from public.filing_documents fd
    join public.filings f on f.id = fd.filing_id and f.status = 'draft'
    join public.filing_income_sources s on s.filing_id = f.id
   where fd.document_id = v_document_id
     and fd.slot like 'platform:%'
     and not exists (
       select 1 from public.filing_documents own
        where own.filing_id = f.id
          and own.document_id = v_document_id
          and own.slot = 'platform:' || s.platform
     );

  update public.extracted_transactions t
     set category = c.category,
         needs_review = c.category = 'unsure' and extract(year from t.date) = v_tax_year
    from (
      select x.id,
             case when x.source_platform = any (v_platforms) then 'platform_payout'
                  else x.ai_category end as category
        from public.extracted_transactions x
       where x.extraction_id = p_extraction_id
    ) c
   where t.id = c.id
     and (t.category is distinct from c.category
          or t.needs_review is distinct from
             (c.category = 'unsure' and extract(year from t.date) = v_tax_year));

  perform public.recalculate_extraction_suggestion(p_extraction_id);
end;
$$;

revoke all on function public.recategorize_extraction(uuid) from public, anon, authenticated;
-- Called by the extract-document Edge Function once a read is saved.
grant execute on function public.recategorize_extraction(uuid) to service_role;

-- Every read statement on a draft filing.
create or replace function public.recategorize_filing(p_filing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select distinct e.id
      from public.filings f
      join public.filing_documents fd on fd.filing_id = f.id and fd.slot like 'platform:%'
      join public.document_extractions e on e.document_id = fd.document_id and e.status = 'done'
     where f.id = p_filing_id
       and f.status = 'draft'
  loop
    perform public.recategorize_extraction(r.id);
  end loop;
end;
$$;

revoke all on function public.recategorize_filing(uuid) from public, anon, authenticated;

-- A platform added to or removed from a draft.
create or replace function public.recategorize_on_platform_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recategorize_filing(coalesce(new.filing_id, old.filing_id));
  return null;
end;
$$;

drop trigger if exists recategorize_on_platform_change on public.filing_income_sources;
create trigger recategorize_on_platform_change
  after insert or delete on public.filing_income_sources
  for each row execute function public.recategorize_on_platform_change();

-- A statement put in (or taken out of) a platform slot.
create or replace function public.recategorize_on_slot_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if new.slot not like 'platform:%' then
    return null;
  end if;
  for r in
    select e.id
      from public.document_extractions e
     where e.status = 'done'
       and e.document_id in (new.document_id, case when tg_op = 'UPDATE' then old.document_id end)
  loop
    perform public.recategorize_extraction(r.id);
  end loop;
  return null;
end;
$$;

drop trigger if exists recategorize_on_slot_change on public.filing_documents;
create trigger recategorize_on_slot_change
  after insert or update of document_id on public.filing_documents
  for each row execute function public.recategorize_on_slot_change();

-- ---------------------------------------------------------------------------
-- 5. The user can overrule any transaction (not just flagged ones), while
--    the statement is on a draft return. Setting null returns it to the
--    automatic category.
-- ---------------------------------------------------------------------------
drop policy if exists "extracted_transactions: answer own flagged" on public.extracted_transactions;
drop policy if exists "extracted_transactions: decide own" on public.extracted_transactions;
create policy "extracted_transactions: decide own"
  on public.extracted_transactions for update to authenticated
  using (user_id = (select auth.uid()) and public.can_decide_extraction(extraction_id))
  with check (user_id = (select auth.uid()) and public.can_decide_extraction(extraction_id));

-- ---------------------------------------------------------------------------
-- 6. The breakdown for "See breakdown"
-- ---------------------------------------------------------------------------
-- Every transaction in the statement with the group it falls in and whether
-- it counts, plus per-group totals — all worked out here, so the app only
-- displays them. Runs as the caller: users only ever see their own.
--   groups: income, platform_payout, own_transfer, refund, loan, reversal,
--           not_income, unsure (still to answer), outside_year
create or replace function public.get_extraction_breakdown(p_extraction_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with e as (
    select e.id, e.currency, e.suggested_income_kobo, e.platform_payouts_kobo, d.tax_year
      from public.document_extractions e
      join public.documents d on d.id = e.document_id
     where e.id = p_extraction_id
       and e.status = 'done'
  ),
  items as (
    select t.id, t.date, t.amount_kobo, t.description, t.category, t.ai_category,
           t.source_platform, t.user_decision, t.needs_review, t.position,
           extract(year from t.date) = e.tax_year as in_year,
           case when t.user_decision is not null then t.user_decision = 'income'
                else t.category = 'income' and not t.needs_review end as counts
      from public.extracted_transactions t, e
     where t.extraction_id = e.id
  ),
  grouped as (
    select i.*,
           case
             when not i.in_year then 'outside_year'
             when i.counts then 'income'
             when i.user_decision is not null then
               case when i.user_decision in ('own_transfer', 'refund', 'loan', 'reversal')
                    then i.user_decision else 'not_income' end
             when i.category = 'income' then 'not_income'
             else i.category
           end as group_key
      from items i
  )
  select jsonb_build_object(
    'currency', e.currency,
    'tax_year', e.tax_year,
    'suggested_income_kobo', e.suggested_income_kobo,
    'platform_payouts_kobo', e.platform_payouts_kobo,
    'can_edit', public.can_decide_extraction(e.id),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('key', g.group_key, 'total_kobo', g.total, 'count', g.n)
                       order by array_position(array['income', 'platform_payout', 'own_transfer',
                         'refund', 'loan', 'reversal', 'not_income', 'unsure', 'outside_year'],
                         g.group_key))
        from (select group_key, sum(amount_kobo) as total, count(*) as n
                from grouped group by group_key) g
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'date', g.date, 'amount_kobo', g.amount_kobo,
               'description', g.description, 'category', g.category,
               'ai_category', g.ai_category, 'source_platform', g.source_platform,
               'user_decision', g.user_decision, 'needs_review', g.needs_review,
               'in_year', g.in_year, 'counts', g.counts, 'group', g.group_key)
             order by g.date, g.position)
        from grouped g
    ), '[]'::jsonb)
  )
  from e;
$$;

revoke all on function public.get_extraction_breakdown(uuid) from public, anon;
grant execute on function public.get_extraction_breakdown(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Bring existing reads up to date
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.document_extractions where status = 'done' loop
    perform public.recategorize_extraction(r.id);
  end loop;
end;
$$;
