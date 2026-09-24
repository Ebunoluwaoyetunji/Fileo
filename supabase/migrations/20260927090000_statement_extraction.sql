-- AI reading of uploaded statements ("extractions").
--
-- When a user uploads a bank or platform statement in the filing flow, the
-- extract-document Edge Function reads it (mock provider today, Anthropic
-- later) and suggests the income it contains. The user always reviews and
-- confirms; nothing here changes their return on its own.
--
--  1. profiles.ai_consent_at / ai_consent_declined_at, and set_ai_consent()
--  2. document_extractions: one per document, written only by the server
--  3. extracted_transactions: the money received that the AI found; users can
--     only answer the flagged ones (user_decision), and only on a draft
--  4. document_extraction_attempts: every paid read, for the daily limit and
--     for cost tracking (token counts only)
--  5. The suggestion: recalculated on the server when the user answers a
--     flagged item, and copied to the matching draft income source
--     (filing_income_sources.ai_suggested_kobo)
--  6. Return Review's "what's missing": unconfirmed AI amounts and
--     unanswered flagged transactions
--
-- Deleting a document deletes its extraction and transactions (cascade).
-- Amounts are whole minor units of the statement's currency (kobo for NGN).
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Consent
-- ---------------------------------------------------------------------------
-- ai_consent_at: when the user allowed AI reading (null = not allowed).
-- ai_consent_declined_at: when they chose "Enter manually" or switched it off
-- in Profile, so the app doesn't keep asking. At most one is set.
alter table public.profiles
  add column if not exists ai_consent_at timestamptz,
  add column if not exists ai_consent_declined_at timestamptz;

-- The user gives or withdraws consent themselves. Runs as the caller, so the
-- profiles update rules apply.
create or replace function public.set_ai_consent(p_allow boolean)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  update public.profiles
     set ai_consent_at = case when p_allow then now() end,
         ai_consent_declined_at = case when p_allow then null else now() end
   where id = (select auth.uid())
  returning ai_consent_at into v_at;
  if not found then
    raise exception 'No profile for this user' using errcode = '42501';
  end if;
  return v_at;
end;
$$;

revoke all on function public.set_ai_consent(boolean) from public, anon;
grant execute on function public.set_ai_consent(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Extractions (one per document)
-- ---------------------------------------------------------------------------
create table if not exists public.document_extractions (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null unique references public.documents (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  -- pending: created, not started; processing: being read now;
  -- done: read (may still carry warnings); failed: something went wrong on
  -- our side or the provider's, can be retried; unreadable: the file itself
  -- can't be read (blurry, password-protected, too many pages, not a
  -- statement, unsupported type) — retrying the same file won't help.
  status                text not null default 'pending',
  provider              text,
  model                 text,
  period_start          date,
  period_end            date,
  currency              text,
  -- The statement's own "total money in" if it prints one, else the sum of
  -- the transactions found.
  total_inflows_kobo    bigint,
  -- Income for the document's tax year: transactions categorised as income
  -- plus flagged ones the user marked as income. Null unless the statement
  -- is in naira (a foreign-currency statement is flagged, never converted).
  suggested_income_kobo bigint,
  -- Plain flags the app turns into messages: partial_year, wrong_year,
  -- period_unknown, foreign_currency, currency_unknown, totals_mismatch,
  -- no_income_found.
  warnings              text[] not null default '{}',
  page_count            integer,
  -- Token usage across every paid attempt (numbers only, for cost tracking).
  input_tokens          integer,
  output_tokens         integer,
  error_code            text,
  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  completed_at          timestamptz,
  constraint document_extractions_status_valid
    check (status in ('pending', 'processing', 'done', 'failed', 'unreadable')),
  constraint document_extractions_currency_valid
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint document_extractions_period_valid
    check (period_start is null or period_end is null or period_start <= period_end),
  constraint document_extractions_amounts_valid check (
    (total_inflows_kobo is null or total_inflows_kobo between 0 and 100000000000000)
    and (suggested_income_kobo is null or suggested_income_kobo between 0 and 100000000000000)
  ),
  constraint document_extractions_warnings_valid check (
    warnings <@ array['partial_year', 'wrong_year', 'period_unknown', 'foreign_currency',
                      'currency_unknown', 'totals_mismatch', 'no_income_found']::text[]
  ),
  constraint document_extractions_tokens_valid
    check (coalesce(input_tokens, 0) >= 0 and coalesce(output_tokens, 0) >= 0),
  constraint document_extractions_error_code_valid check (
    error_code is null or error_code in (
      'unreadable', 'not_a_statement', 'password_protected', 'too_many_pages',
      'unsupported_type', 'file_too_large', 'corrupt_file',
      'timeout', 'provider_unavailable', 'invalid_output', 'refused', 'too_long',
      'download_failed', 'config_error', 'internal'
    )
  )
);

create index if not exists document_extractions_user_id_idx
  on public.document_extractions (user_id);

-- ---------------------------------------------------------------------------
-- 3. Transactions found (money received only)
-- ---------------------------------------------------------------------------
create table if not exists public.extracted_transactions (
  id             uuid primary key default gen_random_uuid(),
  extraction_id  uuid not null references public.document_extractions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  position       integer not null,
  date           date not null,
  amount_kobo    bigint not null,
  -- Short, with long digit runs (account numbers) masked by the server.
  description    text not null,
  category       text not null,
  -- True for 'unsure' items dated in the document's tax year: the user must
  -- say whether each one is income.
  needs_review   boolean not null default false,
  user_decision  text,
  decided_at     timestamptz,
  constraint extracted_transactions_amount_valid
    check (amount_kobo > 0 and amount_kobo <= 100000000000000),
  constraint extracted_transactions_description_valid
    check (char_length(description) between 1 and 120),
  constraint extracted_transactions_category_valid
    check (category in ('income', 'own_transfer', 'refund', 'loan', 'reversal', 'unsure')),
  constraint extracted_transactions_decision_valid check (
    user_decision is null
    or user_decision in ('income', 'own_transfer', 'refund', 'loan', 'reversal', 'not_income')
  ),
  constraint extracted_transactions_decision_only_when_flagged
    check (user_decision is null or needs_review)
);

create index if not exists extracted_transactions_extraction_idx
  on public.extracted_transactions (extraction_id, position);

-- ---------------------------------------------------------------------------
-- 4. Paid attempts (rate limit + cost tracking). Server only.
-- ---------------------------------------------------------------------------
create table if not exists public.document_extraction_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- No foreign key: the attempt still counts after the document is deleted.
  document_id   uuid not null,
  provider      text not null,
  model         text,
  outcome       text,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

create index if not exists document_extraction_attempts_user_created_idx
  on public.document_extraction_attempts (user_id, created_at desc);

-- Claims a document for reading, atomically: creates its extraction, or
-- restarts one that failed or was abandoned (still "processing" after
-- p_stale_seconds). A finished read (done / unreadable) and a read already
-- under way are never touched, so two requests can't both start a paid read.
-- Returns the claimed row, or nothing if it couldn't be claimed.
-- Called only by the extract-document Edge Function (service role).
create or replace function public.claim_document_extraction(
  p_document_id uuid,
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_stale_seconds integer
)
returns table (id uuid, input_tokens integer, output_tokens integer)
language sql
security definer
set search_path = ''
as $$
  insert into public.document_extractions as e
    (document_id, user_id, status, provider, model, started_at)
  values (p_document_id, p_user_id, 'processing', p_provider, p_model, now())
  on conflict (document_id) do update
    set status = 'processing',
        provider = excluded.provider,
        model = excluded.model,
        period_start = null,
        period_end = null,
        currency = null,
        total_inflows_kobo = null,
        suggested_income_kobo = null,
        warnings = '{}',
        page_count = null,
        error_code = null,
        started_at = now(),
        completed_at = null
    where e.status = 'failed'
       or (e.status in ('pending', 'processing')
           and (e.started_at is null
                or e.started_at < now() - make_interval(secs => p_stale_seconds)))
  returning e.id, e.input_tokens, e.output_tokens;
$$;

revoke all on function public.claim_document_extraction(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_document_extraction(uuid, uuid, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Who can do what
-- ---------------------------------------------------------------------------
alter table public.document_extractions enable row level security;
alter table public.extracted_transactions enable row level security;
alter table public.document_extraction_attempts enable row level security;

-- Only the server (service role) writes extractions and attempts.
revoke all on public.document_extractions from anon, authenticated;
revoke all on public.extracted_transactions from anon, authenticated;
revoke all on public.document_extraction_attempts from anon, authenticated;
grant select on public.document_extractions to authenticated;
grant select on public.extracted_transactions to authenticated;
grant update (user_decision) on public.extracted_transactions to authenticated;

drop policy if exists "document_extractions: read own" on public.document_extractions;
create policy "document_extractions: read own"
  on public.document_extractions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "extracted_transactions: read own" on public.extracted_transactions;
create policy "extracted_transactions: read own"
  on public.extracted_transactions for select to authenticated
  using (user_id = (select auth.uid()));

-- May the signed-in user answer flagged items from this extraction? Only
-- while its document sits in one of their draft returns and isn't part of a
-- submitted one. security definer so the policy can look across tables.
create or replace function public.can_decide_extraction(p_extraction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.document_extractions e
      join public.filing_documents fd on fd.document_id = e.document_id
      join public.filings f on f.id = fd.filing_id
     where e.id = p_extraction_id
       and e.user_id = (select auth.uid())
       and e.status = 'done'
       and f.user_id = (select auth.uid())
       and f.status = 'draft'
  )
  and not exists (
    select 1
      from public.document_extractions e
      join public.filing_documents fd on fd.document_id = e.document_id
      join public.filings f on f.id = fd.filing_id
     where e.id = p_extraction_id
       and f.status <> 'draft'
  );
$$;

revoke all on function public.can_decide_extraction(uuid) from public, anon;
grant execute on function public.can_decide_extraction(uuid) to authenticated;

drop policy if exists "extracted_transactions: answer own flagged" on public.extracted_transactions;
create policy "extracted_transactions: answer own flagged"
  on public.extracted_transactions for update to authenticated
  using (
    user_id = (select auth.uid())
    and needs_review
    and public.can_decide_extraction(extraction_id)
  )
  with check (
    user_id = (select auth.uid())
    and needs_review
    and public.can_decide_extraction(extraction_id)
  );

-- decided_at is stamped by the database, not sent by the app.
create or replace function public.stamp_transaction_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_decision is distinct from old.user_decision then
    new.decided_at := case when new.user_decision is null then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_transaction_decision on public.extracted_transactions;
create trigger stamp_transaction_decision
  before update on public.extracted_transactions
  for each row execute function public.stamp_transaction_decision();

-- ---------------------------------------------------------------------------
-- 5. The suggestion
-- ---------------------------------------------------------------------------
-- Income in the document's tax year: 'income' items, plus flagged items the
-- user marked as income. Only for naira statements that were read. (The Edge
-- Function calls this while the read is still 'processing', just before
-- marking it 'done', so the app never sees 'done' without its suggestion.)
create or replace function public.recalculate_extraction_suggestion(p_extraction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion bigint;
begin
  select case
           when e.status in ('processing', 'done') and e.currency = 'NGN' then
             coalesce((
               select sum(t.amount_kobo)
                 from public.extracted_transactions t
                where t.extraction_id = e.id
                  and extract(year from t.date) = d.tax_year
                  and ((not t.needs_review and t.category = 'income')
                       or (t.needs_review and t.user_decision = 'income'))
             ), 0)
         end
    into v_suggestion
    from public.document_extractions e
    join public.documents d on d.id = e.document_id
   where e.id = p_extraction_id;

  update public.document_extractions
     set suggested_income_kobo = v_suggestion
   where id = p_extraction_id
     and suggested_income_kobo is distinct from v_suggestion;
end;
$$;

revoke all on function public.recalculate_extraction_suggestion(uuid) from public, anon, authenticated;
-- Called by the extract-document Edge Function once a read is saved.
grant execute on function public.recalculate_extraction_suggestion(uuid) to service_role;

create or replace function public.recalculate_suggestion_on_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalculate_extraction_suggestion(new.extraction_id);
  return null;
end;
$$;

drop trigger if exists recalculate_suggestion_on_decision on public.extracted_transactions;
create trigger recalculate_suggestion_on_decision
  after update of user_decision on public.extracted_transactions
  for each row
  when (old.user_decision is distinct from new.user_decision)
  execute function public.recalculate_suggestion_on_decision();

-- The suggestion for a platform on a filing: from the document in that
-- platform's slot, once it's been read.
create or replace function public.ai_suggestion_for_slot(p_filing_id uuid, p_platform text)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select e.suggested_income_kobo
    from public.filing_documents fd
    join public.document_extractions e on e.document_id = fd.document_id
   where fd.filing_id = p_filing_id
     and fd.slot = 'platform:' || p_platform
     and e.status = 'done';
$$;

revoke all on function public.ai_suggestion_for_slot(uuid, text) from public, anon, authenticated;

-- Copies the suggestion onto a draft's income source. If the user had
-- accepted the old suggestion unchanged (amount_source 'ai') and it has now
-- changed, their income confirmation is cleared so they check it again.
create or replace function public.sync_ai_suggestion(p_filing_id uuid, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion bigint := public.ai_suggestion_for_slot(p_filing_id, p_platform);
  v_accepted boolean;
begin
  if not exists (select 1 from public.filings where id = p_filing_id and status = 'draft') then
    return;
  end if;
  update public.filing_income_sources s
     set ai_suggested_kobo = v_suggestion
   where s.filing_id = p_filing_id
     and s.platform = p_platform
     and s.ai_suggested_kobo is distinct from v_suggestion
  returning (s.amount_source = 'ai' and s.amount_kobo is distinct from v_suggestion) into v_accepted;
  if v_accepted then
    update public.filings set income_confirmed_at = null where id = p_filing_id;
  end if;
end;
$$;

revoke all on function public.sync_ai_suggestion(uuid, text) from public, anon, authenticated;

-- a) An extraction finished, or its suggestion changed.
create or replace function public.sync_ai_suggestion_from_extraction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select fd.filing_id, substr(fd.slot, 10) as platform
      from public.filing_documents fd
     where fd.document_id = new.document_id
       and fd.slot like 'platform:%'
  loop
    perform public.sync_ai_suggestion(r.filing_id, r.platform);
  end loop;
  return null;
end;
$$;

drop trigger if exists sync_ai_suggestion_from_extraction on public.document_extractions;
create trigger sync_ai_suggestion_from_extraction
  after insert or update of status, suggested_income_kobo on public.document_extractions
  for each row execute function public.sync_ai_suggestion_from_extraction();

-- b) A platform slot now holds a different document (or none).
create or replace function public.sync_ai_suggestion_from_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slot like 'platform:%' then
    perform public.sync_ai_suggestion(new.filing_id, substr(new.slot, 10));
  end if;
  return null;
end;
$$;

drop trigger if exists sync_ai_suggestion_from_slot on public.filing_documents;
create trigger sync_ai_suggestion_from_slot
  after insert or update of document_id on public.filing_documents
  for each row execute function public.sync_ai_suggestion_from_slot();

-- c) An income source is (re)added: start it with the slot's suggestion.
create or replace function public.fill_ai_suggestion_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.ai_suggested_kobo := public.ai_suggestion_for_slot(new.filing_id, new.platform);
  return new;
end;
$$;

drop trigger if exists fill_ai_suggestion_on_insert on public.filing_income_sources;
create trigger fill_ai_suggestion_on_insert
  before insert on public.filing_income_sources
  for each row execute function public.fill_ai_suggestion_on_insert();

-- ---------------------------------------------------------------------------
-- 6. What's missing: + AI amounts not yet confirmed, + flagged transactions
--    not yet answered. Otherwise unchanged from 20260926100000.
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
    -- Unanswered flagged transactions in each platform's statement.
    select s.platform, s.position, count(*) as remaining
      from sources s
      join public.filing_documents fd
        on fd.filing_id = p_filing_id and fd.slot = 'platform:' || s.platform
      join public.document_extractions e
        on e.document_id = fd.document_id and e.status = 'done'
      join public.extracted_transactions t
        on t.extraction_id = e.id and t.needs_review and t.user_decision is null
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
