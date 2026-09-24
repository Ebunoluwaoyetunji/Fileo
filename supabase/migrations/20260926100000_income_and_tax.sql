-- Real income entry, real deduction amounts, and server-side tax calculation.
--
--  1. Income: each source's amount is entered (or, later, suggested by AI and
--     accepted) by the user and must be confirmed. Placeholder amounts saved by
--     earlier versions of the app are cleared from drafts, so those users are
--     asked for their real figures.
--  2. Deductions: the amount the user actually paid (rent paid, pension / NHF
--     contributions, life assurance premiums). The tax rules decide how much of
--     it is allowed.
--  3. Tax rules per tax year (tax_rule_sets), one integer-only calculator
--     (compute_tax), and the result stored in filing_tax_calculations, which
--     only the server writes. Recalculated whenever income or deductions are
--     saved; frozen when the filing is submitted.
--
-- Money is whole kobo (bigint) throughout. Percentages are integer basis points
-- (1% = 100 bp), and every percentage line is rounded to the nearest kobo, with
-- exact halves rounded up: (amount_kobo * rate_bp + 5000) / 10000.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Income entry
-- ---------------------------------------------------------------------------
alter table public.filing_income_sources
  add column if not exists amount_source text,
  add column if not exists ai_suggested_kobo bigint;

alter table public.filing_income_sources
  drop constraint if exists filing_income_sources_amount_source_valid,
  add constraint filing_income_sources_amount_source_valid
    check (amount_source is null or amount_source in ('manual', 'ai')),
  drop constraint if exists filing_income_sources_amount_max,
  -- ₦10,000,000,000 per source: far above any individual's platform income,
  -- low enough to catch a typo'd extra zeros.
  add constraint filing_income_sources_amount_max
    check (amount_kobo is null or amount_kobo <= 1000000000000),
  drop constraint if exists filing_income_sources_ai_suggested_valid,
  add constraint filing_income_sources_ai_suggested_valid
    check (ai_suggested_kobo is null or ai_suggested_kobo between 0 and 1000000000000);

alter table public.filings
  add column if not exists business_expenses_kobo bigint not null default 0,
  add column if not exists income_confirmed_at timestamptz;

alter table public.filings
  drop constraint if exists filings_business_expenses_valid,
  add constraint filings_business_expenses_valid
    check (business_expenses_kobo between 0 and 1000000000000);

-- Placeholder income (every source was ₦4,820,000 before real entry existed):
-- clear it from drafts so the user enters real figures. Submitted filings are
-- left exactly as they were submitted.
update public.filing_income_sources s
   set amount_kobo = null
  from public.filings f
 where f.id = s.filing_id
   and f.status = 'draft'
   and s.amount_source is null
   and s.amount_kobo is not null;

-- ---------------------------------------------------------------------------
-- 2. Deduction amounts: what the user paid (the rules decide what's allowed)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'filing_deductions' and column_name = 'amount_kobo'
  ) then
    alter table public.filing_deductions rename column amount_kobo to amount_paid_kobo;
    -- Drafts held placeholder figures (rent ₦500,000, pension 8% / NHF 2.5% of
    -- the placeholder income, life assurance ₦0): ask for the real amounts.
    update public.filing_deductions d
       set amount_paid_kobo = null
      from public.filings f
     where f.id = d.filing_id and f.status = 'draft';
  end if;
end;
$$;

alter table public.filing_deductions alter column amount_paid_kobo drop not null;
alter table public.filing_deductions
  drop constraint if exists filing_deductions_amount_valid,
  add constraint filing_deductions_amount_valid
    check (amount_paid_kobo is null or amount_paid_kobo between 0 and 1000000000000);

-- Column privileges: users write only these. ai_suggested_kobo is server-only.
revoke insert, update on public.filing_income_sources from authenticated;
grant insert (filing_id, platform, amount_kobo, amount_source, position)
  on public.filing_income_sources to authenticated;
grant update (amount_kobo, amount_source, position) on public.filing_income_sources to authenticated;

revoke insert, update on public.filing_deductions from authenticated;
grant insert (filing_id, deduction_type, amount_paid_kobo) on public.filing_deductions to authenticated;
grant update (amount_paid_kobo) on public.filing_deductions to authenticated;

revoke update on public.filings from authenticated;
grant update (current_step, business_expenses_kobo, income_confirmed_at) on public.filings to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tax rules, one row per rule set (each covers a range of tax years)
-- ---------------------------------------------------------------------------
-- To add a year: insert a new row (new version) covering it. Amounts in kobo,
-- rates in basis points. Readable by signed-in users (the app uses it to show
-- which deductions a year allows); written only by migrations.
create table if not exists public.tax_rule_sets (
  version        text primary key,
  tax_year_from  smallint not null,
  tax_year_to    smallint,             -- null = no end year yet
  name           text not null,
  params         jsonb not null,
  sources        text[] not null default '{}'
);
alter table public.tax_rule_sets enable row level security;
revoke all on public.tax_rule_sets from anon, authenticated;
grant select on public.tax_rule_sets to authenticated;
drop policy if exists "tax_rule_sets: readable" on public.tax_rule_sets;
create policy "tax_rule_sets: readable" on public.tax_rule_sets for select to authenticated using (true);

-- Income earned in 2025: Personal Income Tax Act (PITA), Cap P8 LFN 2004, as
-- amended by the PIT (Amendment) Act 2011 and the Finance Acts 2019 and 2020.
-- Applies to 2025 income even though it's filed in 2026: the Federal
-- Government's General Transition Guidelines for the Tax Acts 2025 say income
-- of individuals under direct assessment for 2025 is taxed under the repealed
-- law; the Nigeria Tax Act applies to income from 1 January 2026.
--   - Consolidated relief allowance (PITA s.33(1), as amended by Finance Act
--     2020 s.29): ₦200,000 or 1% of gross income, whichever is higher, plus 20%
--     of gross income. "Gross income" (Finance Act 2020) is income less
--     non-taxable income, tax-exempt items in para 2 of the Sixth Schedule and
--     allowable business expenses — so CRA is worked out after business
--     expenses and the exempt deductions below.
--   - Tax-exempt deductions: pension contributions under the Pension Reform Act
--     2014 (s.10), National Housing Fund contributions (NHF Act), and life
--     assurance premiums for yourself or your spouse (PITA s.33(4)(d)); no
--     statutory cap on any of them.
--   - No rent relief (rent is taken as covered by the CRA).
--   - Rates (PITA Sixth Schedule): 7% first ₦300,000, 11% next ₦300,000, 15%
--     next ₦500,000, 19% next ₦500,000, 21% next ₦1,600,000, 24% above
--     ₦3,200,000.
--   - Minimum tax (PITA s.37 and Sixth Schedule): 1% of gross income when the
--     tax from the rates is lower. The Finance Act 2020 exemption for people
--     earning the national minimum wage or less applies to income "from an
--     employment", so it isn't applied to freelance / platform income.
--     ⚠️ Flagged for professional review, along with the gross income base.
insert into public.tax_rule_sets (version, tax_year_from, tax_year_to, name, params, sources)
values (
  'NG-PITA-2025.1', 2025, 2025,
  'Personal Income Tax Act (as amended), 2025 income',
  '{
    "regime": "pita",
    "cra": { "fixed_kobo": 20000000, "fixed_alt_rate_bp": 100, "rate_bp": 2000 },
    "bands": [
      { "width_kobo": 30000000,  "rate_bp": 700 },
      { "width_kobo": 30000000,  "rate_bp": 1100 },
      { "width_kobo": 50000000,  "rate_bp": 1500 },
      { "width_kobo": 50000000,  "rate_bp": 1900 },
      { "width_kobo": 160000000, "rate_bp": 2100 },
      { "width_kobo": null,      "rate_bp": 2400 }
    ],
    "minimum_tax_rate_bp": 100,
    "reliefs": {
      "pension":        { "allowed": true },
      "nhf":            { "allowed": true },
      "life_assurance": { "allowed": true },
      "rent": {
        "allowed": false,
        "reason": "Rent relief starts with 2026 income. For 2025, your rent is covered by the automatic consolidated relief allowance."
      }
    }
  }'::jsonb,
  array[
    'Personal Income Tax Act, Cap P8 LFN 2004 (as amended by the PIT (Amendment) Act 2011): s.33, s.37, Sixth Schedule',
    'Finance Act 2020, ss.29-30 (gross income for CRA; minimum tax / minimum wage proviso)',
    'Pension Reform Act 2014, s.10; National Housing Fund Act',
    'Federal Ministry of Finance, General Transition Guidelines for the Tax Acts 2025 (2025 income under direct assessment taxed under the repealed law)'
  ]
)
on conflict (version) do update
  set tax_year_from = excluded.tax_year_from, tax_year_to = excluded.tax_year_to,
      name = excluded.name, params = excluded.params, sources = excluded.sources;

-- Income from 2026: Nigeria Tax Act 2025 (Act No. 7 of 2025, Official Gazette
-- No. 117, 26 June 2025; in force 1 January 2026).
--   - No consolidated relief allowance and no minimum tax for individuals.
--   - Deductions (s.30(2)(a)): NHF contributions, NHIS contributions, pension
--     contributions under the Pension Reform Act, interest on a loan for an
--     owner-occupied home, life insurance / deferred annuity premiums for
--     yourself or your spouse, and rent relief of 20% of annual rent paid,
--     capped at ₦500,000 (s.30(2)(a)(vi); tenants only, declared rent).
--   - Rates (Fourth Schedule): 0% first ₦800,000, 15% next ₦2,200,000, 18%
--     next ₦9,000,000, 21% next ₦13,000,000, 23% next ₦25,000,000, 25% above
--     ₦50,000,000.
insert into public.tax_rule_sets (version, tax_year_from, tax_year_to, name, params, sources)
values (
  'NG-NTA-2026.1', 2026, null,
  'Nigeria Tax Act 2025, income from 2026',
  '{
    "regime": "nta",
    "cra": null,
    "bands": [
      { "width_kobo": 80000000,   "rate_bp": 0 },
      { "width_kobo": 220000000,  "rate_bp": 1500 },
      { "width_kobo": 900000000,  "rate_bp": 1800 },
      { "width_kobo": 1300000000, "rate_bp": 2100 },
      { "width_kobo": 2500000000, "rate_bp": 2300 },
      { "width_kobo": null,       "rate_bp": 2500 }
    ],
    "minimum_tax_rate_bp": null,
    "reliefs": {
      "pension":        { "allowed": true },
      "nhf":            { "allowed": true },
      "life_assurance": { "allowed": true },
      "rent": {
        "allowed": true, "rate_bp": 2000, "cap_kobo": 50000000,
        "note": "20% of the rent you paid, up to ₦500,000."
      }
    }
  }'::jsonb,
  array[
    'Nigeria Tax Act 2025 (No. 7), s.30 (chargeable income and deductions, incl. rent relief s.30(2)(a)(vi))',
    'Nigeria Tax Act 2025, Fourth Schedule (individual income tax rates)'
  ]
)
on conflict (version) do update
  set tax_year_from = excluded.tax_year_from, tax_year_to = excluded.tax_year_to,
      name = excluded.name, params = excluded.params, sources = excluded.sources;

create or replace function public.tax_rules_for_year(p_tax_year smallint)
returns public.tax_rule_sets
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.tax_rule_sets r
   where p_tax_year between r.tax_year_from and coalesce(r.tax_year_to, 9999)
   order by r.tax_year_from desc
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. The calculator (pure: rules + figures in, breakdown out)
-- ---------------------------------------------------------------------------
-- p_rate_bp of p_amount_kobo, rounded to the nearest kobo (halves up).
create or replace function public.tax_percent(p_amount_kobo bigint, p_rate_bp integer)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select (p_amount_kobo * p_rate_bp + 5000) / 10000;
$$;

-- p_claims: what the user paid per deduction, e.g. {"pension": 20000000, "rent": 100000000}.
create or replace function public.compute_tax(
  p_params jsonb,
  p_income_kobo bigint,
  p_expenses_kobo bigint,
  p_claims jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_income bigint := greatest(p_income_kobo - p_expenses_kobo, 0);
  v_code text;
  v_claimed bigint;
  v_rule jsonb;
  v_applied bigint;
  v_status text;
  v_lines jsonb := '[]'::jsonb;
  v_deducted bigint := 0;
  v_cra_rule jsonb := p_params -> 'cra';
  v_base bigint;
  v_cra bigint := 0;
  v_taxable bigint;
  v_remaining bigint;
  v_band jsonb;
  v_width bigint;
  v_in_band bigint;
  v_from bigint := 0;
  v_band_tax bigint;
  v_bands jsonb := '[]'::jsonb;
  v_total_band_tax bigint := 0;
  v_min_rate integer := nullif(p_params ->> 'minimum_tax_rate_bp', '')::integer;
  v_min bigint;
  v_min_applied boolean := false;
  v_due bigint;
begin
  -- Deductions the user claimed, in a fixed order.
  foreach v_code in array array['pension', 'nhf', 'life_assurance', 'rent'] loop
    continue when not (p_claims ? v_code);
    v_claimed := greatest((p_claims ->> v_code)::bigint, 0);
    v_rule := p_params -> 'reliefs' -> v_code;
    if v_rule is null or not coalesce((v_rule ->> 'allowed')::boolean, false) then
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'code', v_code, 'claimed_kobo', v_claimed, 'applied_kobo', 0,
        'status', 'not_applied', 'note', v_rule ->> 'reason'));
      continue;
    end if;
    v_applied := v_claimed;
    v_status := 'applied';
    if v_rule ? 'rate_bp' then
      v_applied := public.tax_percent(v_claimed, (v_rule ->> 'rate_bp')::integer);
    end if;
    if v_rule ? 'cap_kobo' and v_applied > (v_rule ->> 'cap_kobo')::bigint then
      v_applied := (v_rule ->> 'cap_kobo')::bigint;
      v_status := 'capped';
    end if;
    v_deducted := v_deducted + v_applied;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'code', v_code, 'claimed_kobo', v_claimed, 'applied_kobo', v_applied,
      'status', v_status, 'note', v_rule ->> 'note'));
  end loop;

  -- Consolidated relief allowance (PITA only), on gross income after business
  -- expenses and the exempt deductions above.
  if v_cra_rule is not null and jsonb_typeof(v_cra_rule) = 'object' then
    v_base := greatest(v_income - v_deducted, 0);
    v_cra := greatest(
               (v_cra_rule ->> 'fixed_kobo')::bigint,
               public.tax_percent(v_base, (v_cra_rule ->> 'fixed_alt_rate_bp')::integer)
             )
             + public.tax_percent(v_base, (v_cra_rule ->> 'rate_bp')::integer);
    v_lines := jsonb_build_array(jsonb_build_object(
      'code', 'cra', 'claimed_kobo', null, 'applied_kobo', v_cra, 'status', 'applied',
      'note', '₦200,000 or 1% of gross income, whichever is higher, plus 20% of gross income.'))
      || v_lines;
  end if;

  v_taxable := greatest(v_income - v_deducted - v_cra, 0);

  -- Graduated rates, band by band.
  v_remaining := v_taxable;
  for v_band in select value from jsonb_array_elements(p_params -> 'bands') loop
    v_width := nullif(v_band ->> 'width_kobo', '')::bigint;
    v_in_band := case when v_width is null then v_remaining else least(v_remaining, v_width) end;
    v_band_tax := public.tax_percent(v_in_band, (v_band ->> 'rate_bp')::integer);
    v_bands := v_bands || jsonb_build_array(jsonb_build_object(
      'from_kobo', v_from, 'width_kobo', v_width, 'rate_bp', (v_band ->> 'rate_bp')::integer,
      'taxable_kobo', v_in_band, 'tax_kobo', v_band_tax));
    v_total_band_tax := v_total_band_tax + v_band_tax;
    v_remaining := v_remaining - v_in_band;
    v_from := v_from + coalesce(v_width, 0);
  end loop;

  -- Minimum tax (PITA): 1% of gross income when the rates give less.
  v_due := v_total_band_tax;
  if v_min_rate is not null then
    v_min := public.tax_percent(greatest(v_income - v_deducted, 0), v_min_rate);
    if v_income > 0 and v_total_band_tax < v_min then
      v_due := v_min;
      v_min_applied := true;
    end if;
  end if;

  return jsonb_build_object(
    'gross_income_kobo', p_income_kobo,
    'business_expenses_kobo', p_expenses_kobo,
    'income_after_expenses_kobo', v_income,
    'reliefs', v_lines,
    'total_reliefs_kobo', v_deducted + v_cra,
    'taxable_income_kobo', v_taxable,
    'bands', v_bands,
    'band_tax_kobo', v_total_band_tax,
    'minimum_tax_kobo', v_min,
    'minimum_tax_applied', v_min_applied,
    'tax_due_kobo', v_due
  );
end;
$$;

revoke all on function public.compute_tax(jsonb, bigint, bigint, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Stored results (server-only writes)
-- ---------------------------------------------------------------------------
create table if not exists public.filing_tax_calculations (
  filing_id                  uuid primary key references public.filings (id) on delete cascade,
  tax_year                   smallint not null,
  rules_version              text not null references public.tax_rule_sets (version),
  gross_income_kobo          bigint not null,
  business_expenses_kobo     bigint not null,
  income_after_expenses_kobo bigint not null,
  reliefs                    jsonb not null,
  total_reliefs_kobo         bigint not null,
  taxable_income_kobo        bigint not null,
  bands                      jsonb not null,
  band_tax_kobo              bigint not null,
  minimum_tax_kobo           bigint,
  minimum_tax_applied        boolean not null default false,
  tax_due_kobo               bigint not null,
  -- The same income with none of the user's deductions claimed: the
  -- difference is what the deductions saved.
  tax_without_deductions_kobo bigint not null,
  calculated_at              timestamptz not null default now(),
  is_final                   boolean not null default false,
  finalized_at               timestamptz
);

alter table public.filing_tax_calculations enable row level security;
revoke all on public.filing_tax_calculations from anon, authenticated;
grant select on public.filing_tax_calculations to authenticated;
drop policy if exists "filing_tax_calculations: read own" on public.filing_tax_calculations;
create policy "filing_tax_calculations: read own"
  on public.filing_tax_calculations for select to authenticated
  using (public.is_own_filing(filing_id, false));

-- Recalculates a draft from what's saved. Frozen once the filing is submitted.
create or replace function public.recalculate_filing_tax(p_filing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_filing public.filings%rowtype;
  v_rules public.tax_rule_sets%rowtype;
  v_income bigint;
  v_missing_income boolean;
  v_claims jsonb;
  v_with jsonb;
  v_without jsonb;
begin
  select * into v_filing from public.filings where id = p_filing_id;
  if not found or v_filing.status <> 'draft' then
    return; -- gone, or submitted: the stored result is frozen
  end if;

  select * into v_rules from public.tax_rules_for_year(v_filing.tax_year);
  select coalesce(sum(amount_kobo), 0), bool_or(amount_kobo is null) or count(*) = 0
    into v_income, v_missing_income
    from public.filing_income_sources where filing_id = p_filing_id;

  if v_rules.version is null or v_missing_income then
    -- Nothing reliable to calculate yet.
    delete from public.filing_tax_calculations where filing_id = p_filing_id;
    return;
  end if;

  select coalesce(jsonb_object_agg(deduction_type, amount_paid_kobo), '{}'::jsonb)
    into v_claims
    from public.filing_deductions
   where filing_id = p_filing_id and amount_paid_kobo is not null;

  v_with := public.compute_tax(v_rules.params, v_income, v_filing.business_expenses_kobo, v_claims);
  v_without := public.compute_tax(v_rules.params, v_income, v_filing.business_expenses_kobo, '{}'::jsonb);

  insert into public.filing_tax_calculations as c (
    filing_id, tax_year, rules_version, gross_income_kobo, business_expenses_kobo,
    income_after_expenses_kobo, reliefs, total_reliefs_kobo, taxable_income_kobo, bands,
    band_tax_kobo, minimum_tax_kobo, minimum_tax_applied, tax_due_kobo,
    tax_without_deductions_kobo, calculated_at, is_final, finalized_at
  ) values (
    p_filing_id, v_filing.tax_year, v_rules.version,
    (v_with ->> 'gross_income_kobo')::bigint, (v_with ->> 'business_expenses_kobo')::bigint,
    (v_with ->> 'income_after_expenses_kobo')::bigint, v_with -> 'reliefs',
    (v_with ->> 'total_reliefs_kobo')::bigint, (v_with ->> 'taxable_income_kobo')::bigint,
    v_with -> 'bands', (v_with ->> 'band_tax_kobo')::bigint,
    nullif(v_with ->> 'minimum_tax_kobo', '')::bigint, (v_with ->> 'minimum_tax_applied')::boolean,
    (v_with ->> 'tax_due_kobo')::bigint, (v_without ->> 'tax_due_kobo')::bigint,
    now(), false, null
  )
  on conflict (filing_id) do update set
    tax_year = excluded.tax_year, rules_version = excluded.rules_version,
    gross_income_kobo = excluded.gross_income_kobo,
    business_expenses_kobo = excluded.business_expenses_kobo,
    income_after_expenses_kobo = excluded.income_after_expenses_kobo,
    reliefs = excluded.reliefs, total_reliefs_kobo = excluded.total_reliefs_kobo,
    taxable_income_kobo = excluded.taxable_income_kobo, bands = excluded.bands,
    band_tax_kobo = excluded.band_tax_kobo, minimum_tax_kobo = excluded.minimum_tax_kobo,
    minimum_tax_applied = excluded.minimum_tax_applied, tax_due_kobo = excluded.tax_due_kobo,
    tax_without_deductions_kobo = excluded.tax_without_deductions_kobo,
    calculated_at = excluded.calculated_at
  where not c.is_final;
end;
$$;

revoke all on function public.recalculate_filing_tax(uuid) from public, anon, authenticated;

-- Whenever income, expenses or deductions change on a draft.
create or replace function public.recalculate_filing_tax_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'filings' then
    perform public.recalculate_filing_tax(new.id);
  else
    perform public.recalculate_filing_tax(coalesce(new.filing_id, old.filing_id));
  end if;
  return null;
end;
$$;

drop trigger if exists recalculate_tax_on_income on public.filing_income_sources;
create trigger recalculate_tax_on_income
  after insert or update or delete on public.filing_income_sources
  for each row execute function public.recalculate_filing_tax_trigger();

drop trigger if exists recalculate_tax_on_deductions on public.filing_deductions;
create trigger recalculate_tax_on_deductions
  after insert or update or delete on public.filing_deductions
  for each row execute function public.recalculate_filing_tax_trigger();

drop trigger if exists recalculate_tax_on_expenses on public.filings;
create trigger recalculate_tax_on_expenses
  after update of business_expenses_kobo on public.filings
  for each row
  when (old.business_expenses_kobo is distinct from new.business_expenses_kobo)
  execute function public.recalculate_filing_tax_trigger();

-- Existing drafts: calculate now (most will wait for real income first).
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.filings where status = 'draft' loop
    perform public.recalculate_filing_tax(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Saving a step (replaces the earlier version: amount sources, expenses,
--    income confirmation, deduction amounts paid)
-- ---------------------------------------------------------------------------
drop function if exists public.save_filing_progress(uuid, text, jsonb, jsonb, jsonb);

-- Runs as the calling user (security invoker), so every row-level rule still
-- applies. Passing null for a section leaves it unchanged.
--   p_income_sources: [{ "platform", "amount_kobo" | null, "amount_source": "manual" | "ai" | null }]
--   p_deductions:     [{ "deduction_type", "amount_paid_kobo" | null }]
--   p_documents:      [{ "slot", "document_id" | null }]
--   p_business_expenses_kobo: total allowable business expenses
--   p_income_confirmed: true when the user has just confirmed their income.
-- Any change to income or expenses without p_income_confirmed = true clears
-- the confirmation, so changed figures must be confirmed again.
create or replace function public.save_filing_progress(
  p_filing_id uuid,
  p_current_step text,
  p_income_sources jsonb default null,
  p_deductions jsonb default null,
  p_documents jsonb default null,
  p_business_expenses_kobo bigint default null,
  p_income_confirmed boolean default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_expenses_before bigint;
begin
  update public.filings
     set current_step = p_current_step
   where id = p_filing_id
     and status = 'draft'
  returning business_expenses_kobo into v_expenses_before;
  if not found then
    raise exception 'Only your own draft filings can be changed'
      using errcode = '42501', hint = 'not_draft';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(platform, amount_kobo) order by platform), '[]'::jsonb)
    into v_before
    from public.filing_income_sources where filing_id = p_filing_id;

  if p_income_sources is not null then
    delete from public.filing_income_sources s
     where s.filing_id = p_filing_id
       and s.platform not in (
         select x ->> 'platform' from jsonb_array_elements(p_income_sources) as x
       );
    insert into public.filing_income_sources (filing_id, platform, amount_kobo, amount_source, position)
    select p_filing_id, x ->> 'platform', (x ->> 'amount_kobo')::bigint,
           nullif(x ->> 'amount_source', ''), (ord - 1)::smallint
      from jsonb_array_elements(p_income_sources) with ordinality as t (x, ord)
    on conflict (filing_id, platform)
      do update set amount_kobo = excluded.amount_kobo,
                    amount_source = excluded.amount_source,
                    position = excluded.position;
  end if;

  if p_business_expenses_kobo is not null then
    update public.filings
       set business_expenses_kobo = p_business_expenses_kobo
     where id = p_filing_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(platform, amount_kobo) order by platform), '[]'::jsonb)
    into v_after
    from public.filing_income_sources where filing_id = p_filing_id;

  if p_income_confirmed is true then
    update public.filings set income_confirmed_at = now() where id = p_filing_id;
  elsif v_before is distinct from v_after
     or (p_business_expenses_kobo is not null and p_business_expenses_kobo is distinct from v_expenses_before) then
    update public.filings set income_confirmed_at = null where id = p_filing_id;
  end if;

  if p_deductions is not null then
    delete from public.filing_deductions d
     where d.filing_id = p_filing_id
       and d.deduction_type not in (
         select x ->> 'deduction_type' from jsonb_array_elements(p_deductions) as x
       );
    insert into public.filing_deductions (filing_id, deduction_type, amount_paid_kobo)
    select p_filing_id, x ->> 'deduction_type', (x ->> 'amount_paid_kobo')::bigint
      from jsonb_array_elements(p_deductions) as x
    on conflict (filing_id, deduction_type)
      do update set amount_paid_kobo = excluded.amount_paid_kobo;
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

revoke all on function public.save_filing_progress(uuid, text, jsonb, jsonb, jsonb, bigint, boolean)
  from public, anon;
grant execute on function public.save_filing_progress(uuid, text, jsonb, jsonb, jsonb, bigint, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 7. What's missing: now also unconfirmed income and deduction amounts, and
--    only deductions the tax year allows
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
    select s.platform, s.amount_kobo, s.position
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
    select 2, 0, 0, jsonb_build_object('type', 'income_unconfirmed')
      from f
     where f.income_confirmed_at is null
       and exists (select 1 from sources)
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
-- 8. Submitting: final calculation, then frozen
-- ---------------------------------------------------------------------------
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

  -- The figures the return is submitted with.
  perform public.recalculate_filing_tax(p_filing_id);
  if not exists (select 1 from public.filing_tax_calculations c where c.filing_id = p_filing_id) then
    raise exception 'The tax on this filing could not be calculated'
      using errcode = 'P0001', hint = 'no_calculation';
  end if;

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

  update public.filing_tax_calculations c
     set is_final = true, finalized_at = v_now
   where c.filing_id = p_filing_id;

  return query select v_reference, v_now;
end;
$$;

revoke all on function public.submit_filing(uuid) from public, anon;
grant execute on function public.submit_filing(uuid) to authenticated;
