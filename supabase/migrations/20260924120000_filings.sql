-- Real filings: a user's tax return in progress (draft) and their history.
--
-- Structure:
--   filings                 one row per tax return (draft -> submitted -> processing
--                           -> completed | rejected).
--   filing_income_sources   the platforms/banks selected for a filing, one row each,
--                           with that source's income (kobo, filled in at Income Summary).
--   filing_deductions       each deduction claimed: type and amount (kobo).
--   filing_documents        which uploaded document fills which slot of the filing:
--                           'platform:<name>' (Upload Documents) or
--                           'deduction:<type>' (a deduction's supporting document).
--
-- Why one slot table instead of a document_id column on each table: the same rule
-- ("if the document is deleted, the slot just becomes empty") and the same submit
-- check apply to every slot, and a document can be attached the moment it's
-- uploaded, before the deduction or income row it supports has been saved. A
-- deduction's linked document is the filing_documents row 'deduction:<type>'.
--
-- Money is stored as whole kobo (bigint), never floats. No computed tax figures are
-- stored here; that comes with the server-side tax calculation.
--
-- Locking: users can only create and change drafts. Once submitted, the filing and
-- every related row are read-only for the user (row-level security), and only the
-- server (submit_filing below, or the service role) can set status, reference and
-- submitted_at.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.filings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tax_year     smallint not null,
  status       text not null default 'draft',
  current_step text not null default 'select_platform',
  reference    text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz,
  constraint filings_tax_year_valid check (tax_year between 2000 and 2100),
  constraint filings_status_valid check (
    status in ('draft', 'submitted', 'processing', 'completed', 'rejected')
  ),
  constraint filings_current_step_valid check (
    current_step in ('select_platform', 'upload_documents', 'income_summary', 'deductions', 'return_review')
  ),
  -- A draft has no reference or submission time; anything past draft has both.
  constraint filings_submission_fields check (
    (status = 'draft' and reference is null and submitted_at is null)
    or (status <> 'draft' and reference is not null and submitted_at is not null)
  )
);

-- Only one draft per user per tax year.
create unique index if not exists filings_one_draft_per_year
  on public.filings (user_id, tax_year) where status = 'draft';
create index if not exists filings_user_id_idx on public.filings (user_id, created_at desc);

create table if not exists public.filing_income_sources (
  id          uuid primary key default gen_random_uuid(),
  filing_id   uuid not null references public.filings (id) on delete cascade,
  platform    text not null,
  -- Filled in when the user confirms income. Placeholder figures until real
  -- statement parsing exists (see app/(app)/income-summary.tsx).
  amount_kobo bigint,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  constraint filing_income_sources_unique unique (filing_id, platform),
  constraint filing_income_sources_platform_length check (char_length(platform) between 1 and 100),
  constraint filing_income_sources_amount_valid check (amount_kobo is null or amount_kobo >= 0)
);

create table if not exists public.filing_deductions (
  id             uuid primary key default gen_random_uuid(),
  filing_id      uuid not null references public.filings (id) on delete cascade,
  deduction_type text not null,
  amount_kobo    bigint not null,
  created_at     timestamptz not null default now(),
  constraint filing_deductions_unique unique (filing_id, deduction_type),
  constraint filing_deductions_type_valid check (
    deduction_type in ('rent', 'life_assurance', 'pension', 'nhf')
  ),
  constraint filing_deductions_amount_valid check (amount_kobo >= 0)
);

create table if not exists public.filing_documents (
  filing_id   uuid not null references public.filings (id) on delete cascade,
  slot        text not null,
  -- Deleting the document empties the slot; the filing itself is untouched.
  document_id uuid references public.documents (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (filing_id, slot),
  constraint filing_documents_slot_valid check (
    slot ~ '^(platform|deduction):.+$' and char_length(slot) <= 120
  )
);
create index if not exists filing_documents_document_id_idx on public.filing_documents (document_id);

-- Banks whose statements Fileo pulls automatically, so they don't need an
-- uploaded document. Must match NIGERIAN_BANKS in constants/platforms.ts.
create table if not exists public.auto_pull_platforms (
  name text primary key
);
insert into public.auto_pull_platforms (name) values
  ('Zenith bank'), ('Firstbank of Nigeria'), ('UBA'), ('Guaranty Trust Bank'), ('Nexapay'),
  ('FairMoney'), ('Wema Bank'), ('Stanbic IBTC (Standard chartered bank)'), ('Union Bank'),
  ('VFD Group'), ('Pocketmoney'), ('Access Bank')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 2. updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists filings_set_updated_at on public.filings;
create trigger filings_set_updated_at
  before update on public.filings
  for each row execute function public.set_updated_at();

drop trigger if exists filing_documents_set_updated_at on public.filing_documents;
create trigger filing_documents_set_updated_at
  before update on public.filing_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Privileges: signed-out requests get nothing; signed-in users only the
--    columns they're allowed to write
-- ---------------------------------------------------------------------------
revoke all on public.filings, public.filing_income_sources, public.filing_deductions,
  public.filing_documents, public.auto_pull_platforms from anon, authenticated;

-- filings: users set only tax_year (and the starting step) when creating a draft,
-- and only current_step afterwards. status, reference, submitted_at and user_id
-- are never writable by users.
grant select, delete on public.filings to authenticated;
grant insert (tax_year, current_step) on public.filings to authenticated;
grant update (current_step) on public.filings to authenticated;

grant select, delete on public.filing_income_sources to authenticated;
grant insert (filing_id, platform, amount_kobo, position) on public.filing_income_sources to authenticated;
grant update (amount_kobo, position) on public.filing_income_sources to authenticated;

grant select, delete on public.filing_deductions to authenticated;
grant insert (filing_id, deduction_type, amount_kobo) on public.filing_deductions to authenticated;
grant update (amount_kobo) on public.filing_deductions to authenticated;

grant select, delete on public.filing_documents to authenticated;
grant insert (filing_id, slot, document_id) on public.filing_documents to authenticated;
grant update (document_id) on public.filing_documents to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Row-level security
-- ---------------------------------------------------------------------------
alter table public.filings enable row level security;
alter table public.filing_income_sources enable row level security;
alter table public.filing_deductions enable row level security;
alter table public.filing_documents enable row level security;
alter table public.auto_pull_platforms enable row level security; -- no policies: server only

-- filings ----------------------------------------------------------------
drop policy if exists "filings: read own" on public.filings;
create policy "filings: read own"
  on public.filings for select to authenticated
  using (user_id = (select auth.uid()));

-- Has the signed-in user already submitted a return for this tax year?
-- security definer so the insert policy below can ask without reading
-- public.filings through its own policies (Postgres rejects that as
-- recursive). It only ever looks at the caller's own filings.
create or replace function public.has_submitted_tax_year(p_tax_year smallint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.filings f
     where f.user_id = (select auth.uid())
       and f.tax_year = p_tax_year
       and f.status <> 'draft'
  );
$$;
revoke all on function public.has_submitted_tax_year(smallint) from public, anon;
grant execute on function public.has_submitted_tax_year(smallint) to authenticated;

-- New drafts only, for a tax year that has ended, and not for a year the user
-- has already submitted.
drop policy if exists "filings: create own draft" on public.filings;
create policy "filings: create own draft"
  on public.filings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'draft'
    and reference is null
    and submitted_at is null
    and tax_year < extract(year from (now() at time zone 'Africa/Lagos'))::int
    and not public.has_submitted_tax_year(tax_year)
  );

drop policy if exists "filings: update own draft" on public.filings;
create policy "filings: update own draft"
  on public.filings for update to authenticated
  using (user_id = (select auth.uid()) and status = 'draft')
  with check (user_id = (select auth.uid()) and status = 'draft');

drop policy if exists "filings: delete own draft" on public.filings;
create policy "filings: delete own draft"
  on public.filings for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'draft');

-- Related rows: readable when the filing is the user's own; writable only while
-- that filing is still a draft.
create or replace function public.is_own_filing(p_filing_id uuid, p_draft_only boolean)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.filings f
     where f.id = p_filing_id
       and f.user_id = (select auth.uid())
       and (not p_draft_only or f.status = 'draft')
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['filing_income_sources', 'filing_deductions', 'filing_documents'] loop
    execute format('drop policy if exists "%1$s: read own" on public.%1$I', t);
    execute format(
      'create policy "%1$s: read own" on public.%1$I for select to authenticated
         using (public.is_own_filing(filing_id, false))', t);
    execute format('drop policy if exists "%1$s: add to own draft" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: change own draft" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: remove from own draft" on public.%1$I', t);
    execute format(
      'create policy "%1$s: remove from own draft" on public.%1$I for delete to authenticated
         using (public.is_own_filing(filing_id, true))', t);
  end loop;
end;
$$;

create policy "filing_income_sources: add to own draft"
  on public.filing_income_sources for insert to authenticated
  with check (public.is_own_filing(filing_id, true));
create policy "filing_income_sources: change own draft"
  on public.filing_income_sources for update to authenticated
  using (public.is_own_filing(filing_id, true))
  with check (public.is_own_filing(filing_id, true));

create policy "filing_deductions: add to own draft"
  on public.filing_deductions for insert to authenticated
  with check (public.is_own_filing(filing_id, true));
create policy "filing_deductions: change own draft"
  on public.filing_deductions for update to authenticated
  using (public.is_own_filing(filing_id, true))
  with check (public.is_own_filing(filing_id, true));

-- A slot can only hold one of the user's own documents (documents' own RLS
-- hides everyone else's).
create policy "filing_documents: add to own draft"
  on public.filing_documents for insert to authenticated
  with check (
    public.is_own_filing(filing_id, true)
    and (document_id is null
         or exists (select 1 from public.documents d where d.id = document_id))
  );
create policy "filing_documents: change own draft"
  on public.filing_documents for update to authenticated
  using (public.is_own_filing(filing_id, true))
  with check (
    public.is_own_filing(filing_id, true)
    and (document_id is null
         or exists (select 1 from public.documents d where d.id = document_id))
  );

-- ---------------------------------------------------------------------------
-- 5. Saving a step: one call, all-or-nothing
-- ---------------------------------------------------------------------------
-- Runs as the calling user (security invoker), so every row-level rule above
-- still applies: it only works on the caller's own draft. Passing null for a
-- section leaves it unchanged.
--   p_income_sources: [{ "platform": "...", "amount_kobo": 123 | null }, ...]
--                     (replaces the list; order is kept)
--   p_deductions:     [{ "deduction_type": "rent", "amount_kobo": 123 }, ...]
--                     (replaces the list)
--   p_documents:      [{ "slot": "platform:Paystack", "document_id": "uuid" | null }, ...]
--                     (upserts these slots; other slots are left as they are)
create or replace function public.save_filing_progress(
  p_filing_id uuid,
  p_current_step text,
  p_income_sources jsonb default null,
  p_deductions jsonb default null,
  p_documents jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.filings
     set current_step = p_current_step
   where id = p_filing_id
     and status = 'draft';
  if not found then
    raise exception 'Only your own draft filings can be changed'
      using errcode = '42501', hint = 'not_draft';
  end if;

  if p_income_sources is not null then
    delete from public.filing_income_sources s
     where s.filing_id = p_filing_id
       and s.platform not in (
         select x ->> 'platform' from jsonb_array_elements(p_income_sources) as x
       );
    insert into public.filing_income_sources (filing_id, platform, amount_kobo, position)
    select p_filing_id, x ->> 'platform', (x ->> 'amount_kobo')::bigint, (ord - 1)::smallint
      from jsonb_array_elements(p_income_sources) with ordinality as t (x, ord)
    on conflict (filing_id, platform)
      do update set amount_kobo = excluded.amount_kobo, position = excluded.position;
  end if;

  if p_deductions is not null then
    delete from public.filing_deductions d
     where d.filing_id = p_filing_id
       and d.deduction_type not in (
         select x ->> 'deduction_type' from jsonb_array_elements(p_deductions) as x
       );
    insert into public.filing_deductions (filing_id, deduction_type, amount_kobo)
    select p_filing_id, x ->> 'deduction_type', (x ->> 'amount_kobo')::bigint
      from jsonb_array_elements(p_deductions) as x
    on conflict (filing_id, deduction_type)
      do update set amount_kobo = excluded.amount_kobo;
  end if;

  if p_documents is not null then
    insert into public.filing_documents (filing_id, slot, document_id)
    select p_filing_id, x ->> 'slot', nullif(x ->> 'document_id', '')::uuid
      from jsonb_array_elements(p_documents) as x
    on conflict (filing_id, slot)
      do update set document_id = excluded.document_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Submitting: the only way a filing leaves draft
-- ---------------------------------------------------------------------------
-- A database function rather than an Edge Function: it runs in one transaction
-- next to the data (the filing row is locked while it's checked and updated, so
-- two taps or two devices can't both submit), needs no extra deployment or
-- secret, and is called from the app like any other request.
--
-- security definer so it can set the server-only columns, which is why it checks
-- ownership itself. Required before submitting:
--   - the user has reached Return Review (current_step),
--   - at least one income source, each with a confirmed amount,
--   - a document for every source that isn't an auto-pulled bank,
--   - a document for every deduction claimed.
-- On failure the error hint is 'incomplete' and the detail lists what's missing
-- (review, income_sources, income_amounts, platform_documents, deduction_documents).
create or replace function public.submit_filing(p_filing_id uuid)
returns table (reference text, submitted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_filing public.filings%rowtype;
  v_missing text[] := array[]::text[];
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

  if v_filing.current_step <> 'return_review' then
    v_missing := array_append(v_missing, 'review');
  end if;
  if not exists (select 1 from public.filing_income_sources s where s.filing_id = p_filing_id) then
    v_missing := array_append(v_missing, 'income_sources');
  end if;
  if exists (
    select 1 from public.filing_income_sources s
     where s.filing_id = p_filing_id and s.amount_kobo is null
  ) then
    v_missing := array_append(v_missing, 'income_amounts');
  end if;
  if exists (
    select 1 from public.filing_income_sources s
     where s.filing_id = p_filing_id
       and not exists (select 1 from public.auto_pull_platforms a where a.name = s.platform)
       and not exists (
         select 1 from public.filing_documents d
          where d.filing_id = p_filing_id
            and d.slot = 'platform:' || s.platform
            and d.document_id is not null
       )
  ) then
    v_missing := array_append(v_missing, 'platform_documents');
  end if;
  if exists (
    select 1 from public.filing_deductions x
     where x.filing_id = p_filing_id
       and not exists (
         select 1 from public.filing_documents d
          where d.filing_id = p_filing_id
            and d.slot = 'deduction:' || x.deduction_type
            and d.document_id is not null
       )
  ) then
    v_missing := array_append(v_missing, 'deduction_documents');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'This filing is missing required steps'
      using errcode = 'P0001', hint = 'incomplete', detail = array_to_string(v_missing, ',');
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

revoke all on function public.save_filing_progress(uuid, text, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.submit_filing(uuid) from public, anon;
revoke all on function public.is_own_filing(uuid, boolean) from public, anon;
grant execute on function public.save_filing_progress(uuid, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.submit_filing(uuid) to authenticated;
grant execute on function public.is_own_filing(uuid, boolean) to authenticated;
