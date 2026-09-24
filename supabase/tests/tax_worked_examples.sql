-- Worked tax examples for both rule sets, checked against the server's
-- calculator (public.compute_tax). Read-only: it changes nothing.
--
-- How to run: paste into the Supabase dashboard's SQL Editor and press Run.
-- Every row should say PASS. Each example's working is written out in the
-- comments so a tax professional can check the expected figures by hand.
-- All amounts are naira; the calculator works in whole kobo and rounds each
-- percentage to the nearest kobo (halves up).
--
-- 2025 income: Personal Income Tax Act (as amended), rules NG-PITA-2025.1
--   Gross income (GI) = income − business expenses − pension − NHF − life assurance
--   CRA = the higher of ₦200,000 or 1% of GI, plus 20% of GI
--   Taxable = income − expenses − those deductions − CRA (never below 0)
--   Bands: 7% on the first ₦300,000, 11% next ₦300,000, 15% next ₦500,000,
--          19% next ₦500,000, 21% next ₦1,600,000, 24% above ₦3,200,000
--   Minimum tax: 1% of GI, charged instead when the band tax is lower
--   Rent: not a deduction for 2025 (covered by CRA)
--
-- 2026 income: Nigeria Tax Act 2025, rules NG-NTA-2026.1
--   Taxable = income − expenses − pension − NHF − life assurance − rent relief
--   Rent relief = 20% of rent paid, capped at ₦500,000
--   Bands: 0% on the first ₦800,000, 15% next ₦2,200,000, 18% next ₦9,000,000,
--          21% next ₦13,000,000, 23% next ₦25,000,000, 25% above ₦50,000,000
--   No CRA, no minimum tax

with examples (rules, example, income, expenses, claims, exp_reliefs, exp_taxable, exp_min_tax, exp_tax_due) as (
  values
  -- ── 2025 ───────────────────────────────────────────────────────────────
  -- GI 0 → CRA ₦200,000 (nothing left to relieve) → taxable 0 → tax 0; minimum 1% × 0 = 0.
  ('NG-PITA-2025.1', 'Zero income', 0::numeric, 0::numeric, '{}'::jsonb, 200000::numeric, 0::numeric, 0::numeric, 0::numeric),
  -- CRA = 200,000 + 20% × 250,000 (50,000) = 250,000 → taxable 0 → band tax 0.
  -- Minimum tax 1% × 250,000 = 2,500 is higher, so tax due is ₦2,500.
  ('NG-PITA-2025.1', 'Very low income (minimum tax applies)', 250000, 0, '{}', 250000, 0, 2500, 2500),
  -- CRA = 200,000 + 100,000 = 300,000 → taxable 200,000 → 7% = 14,000 (minimum 5,000 is lower).
  ('NG-PITA-2025.1', '₦500,000', 500000, 0, '{}', 300000, 200000, 5000, 14000),
  -- CRA = 200,000 + 200,000 = 400,000 → taxable 600,000 → 21,000 + 33,000 = 54,000.
  ('NG-PITA-2025.1', '₦1,000,000', 1000000, 0, '{}', 400000, 600000, 10000, 54000),
  -- Income after expenses 4,500,000; pension 200,000 + NHF 50,000 + life 100,000 = 350,000;
  -- rent ₦1,000,000 claimed but NOT applied (2025). GI 4,150,000 → CRA 200,000 + 830,000 = 1,030,000.
  -- Taxable 4,500,000 − 350,000 − 1,030,000 = 3,120,000
  --   → 21,000 + 33,000 + 75,000 + 95,000 + 21% × 1,520,000 (319,200) = 543,200. Minimum 41,500.
  ('NG-PITA-2025.1', 'Middle income, expenses and deductions', 4820000, 320000,
     '{"pension": 20000000, "nhf": 5000000, "life_assurance": 10000000, "rent": 100000000}', 1380000, 3120000, 41500, 543200),
  -- Same without deductions: GI 4,500,000 → CRA 1,100,000 → taxable 3,400,000
  --   → 560,000 + 24% × 200,000 (48,000) = 608,000. Deductions saved 608,000 − 543,200 = 64,800.
  ('NG-PITA-2025.1', 'Middle income, no deductions', 4820000, 320000, '{}', 1100000, 3400000, 45000, 608000),
  -- GI 58,800,000 → CRA 588,000 + 11,760,000 = 12,348,000 → taxable 46,452,000
  --   → 560,000 + 24% × 43,252,000 (10,380,480) = 10,940,480.
  ('NG-PITA-2025.1', 'High income', 60000000, 0, '{"pension": 120000000}', 13548000, 46452000, 588000, 10940480),
  -- Rounding: 1% of 1,234,567.89 = 12,345.6789 → 12,345.68; 20% = 246,913.578 → 246,913.58.
  -- CRA 446,913.58 → taxable 787,654.31 → 21,000 + 33,000 + 15% × 187,654.31 (28,148.1465 → 28,148.15) = 82,148.15.
  ('NG-PITA-2025.1', 'Rounding (₦1,234,567.89)', 1234567.89, 0, '{}', 446913.58, 787654.31, 12345.68, 82148.15),

  -- ── 2026 ───────────────────────────────────────────────────────────────
  ('NG-NTA-2026.1', 'Zero income', 0, 0, '{}', 0, 0, null, 0),
  -- All within the 0% band; there is no minimum tax.
  ('NG-NTA-2026.1', 'Very low income', 500000, 0, '{}', 0, 500000, null, 0),
  ('NG-NTA-2026.1', 'Exactly ₦800,000', 800000, 0, '{}', 0, 800000, null, 0),
  -- 15% × 200,000 = 30,000.
  ('NG-NTA-2026.1', '₦1,000,000', 1000000, 0, '{}', 0, 1000000, null, 30000),
  -- Deductions 200,000 + 50,000 + 100,000 + rent relief 20% × 1,000,000 (200,000) = 550,000.
  -- Taxable 3,950,000 → 15% × 2,200,000 (330,000) + 18% × 950,000 (171,000) = 501,000.
  ('NG-NTA-2026.1', 'Middle income, expenses and deductions', 4820000, 320000,
     '{"pension": 20000000, "nhf": 5000000, "life_assurance": 10000000, "rent": 100000000}', 550000, 3950000, null, 501000),
  -- Taxable 4,500,000 → 330,000 + 18% × 1,500,000 (270,000) = 600,000. Deductions saved 99,000.
  ('NG-NTA-2026.1', 'Middle income, no deductions', 4820000, 320000, '{}', 0, 4500000, null, 600000),
  -- 20% × 3,000,000 = 600,000, capped at 500,000. Taxable 9,500,000 → 330,000 + 18% × 6,500,000 (1,170,000) = 1,500,000.
  ('NG-NTA-2026.1', 'Rent relief capped at ₦500,000', 10000000, 0, '{"rent": 300000000}', 500000, 9500000, null, 1500000),
  -- Taxable 58,800,000 → 330,000 + 1,620,000 + 2,730,000 + 5,750,000 + 25% × 8,800,000 (2,200,000) = 12,630,000.
  ('NG-NTA-2026.1', 'High income', 60000000, 0, '{"pension": 120000000}', 1200000, 58800000, null, 12630000),
  -- 15% × 434,567.89 = 65,185.1835 → 65,185.18.
  ('NG-NTA-2026.1', 'Rounding (₦1,234,567.89)', 1234567.89, 0, '{}', 0, 1234567.89, null, 65185.18),
  -- Taxable income never goes below zero.
  ('NG-NTA-2026.1', 'Deductions bigger than income', 300000, 0, '{"pension": 50000000}', 500000, 0, null, 0)
),
results as (
  select e.*,
         public.compute_tax(r.params, (e.income * 100)::bigint, (e.expenses * 100)::bigint, e.claims) as calc
    from examples e
    join public.tax_rule_sets r on r.version = e.rules
)
select rules,
       example,
       ((calc->>'total_reliefs_kobo')::numeric / 100)::numeric(16, 2) as reliefs,
       ((calc->>'taxable_income_kobo')::numeric / 100)::numeric(16, 2) as taxable_income,
       ((calc->>'minimum_tax_kobo')::numeric / 100)::numeric(16, 2) as minimum_tax,
       ((calc->>'tax_due_kobo')::numeric / 100)::numeric(16, 2) as tax_due,
       exp_tax_due::numeric(16, 2) as expected_tax_due,
       case
         when (calc->>'total_reliefs_kobo')::numeric = exp_reliefs * 100
          and (calc->>'taxable_income_kobo')::numeric = exp_taxable * 100
          and (calc->>'minimum_tax_kobo')::numeric is not distinct from exp_min_tax * 100
          and (calc->>'tax_due_kobo')::numeric = exp_tax_due * 100
         then 'PASS' else 'FAIL'
       end as result
  from results
 order by rules desc, example;
