-- Made-up, complete draft return for the Return Review screenshots and video.
-- Run against a LOCAL/TEST database only, after creating the account
-- demo@example.com (email confirmed) and marking its profile
-- identity_verified. Every name, file and figure here is invented.
--   Income: Paystack ₦3,200,000 · Upwork ₦1,850,000 · GTBank ₦720,000
--   Business expenses ₦350,000
--   Pension ₦420,000 · Life assurance ₦96,000 · NHF ₦85,000
--   Rent ₦900,000 (claimed, but rent relief only starts with 2026 income)
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@example.com');
  f uuid;
  doc record;
begin
  if u is null then raise exception 'Create the demo@example.com account first'; end if;
  delete from public.filings where user_id = u;
  delete from public.documents where user_id = u;
  insert into public.filings (user_id, tax_year, status, current_step, business_expenses_kobo, income_confirmed_at)
    values (u, 2025, 'draft', 'return_review', 35000000, now()) returning id into f;
  insert into public.filing_income_sources (filing_id, platform, amount_kobo, position, amount_source) values
    (f, 'Paystack',            320000000, 0, 'manual'),
    (f, 'Upwork',              185000000, 1, 'manual'),
    (f, 'Guaranty Trust Bank',  72000000, 2, 'manual');
  insert into public.filing_deductions (filing_id, deduction_type, amount_paid_kobo) values
    (f, 'pension',        42000000),
    (f, 'life_assurance',  9600000),
    (f, 'nhf',             8500000),
    (f, 'rent',           90000000);
  for doc in
    select * from (values
      ('platform:Paystack',            'Paystack settlements 2025.pdf',  'bank_statement', 'upload_step'),
      ('platform:Upwork',              'Upwork earnings 2025.pdf',       'invoice',        'upload_step'),
      ('platform:Guaranty Trust Bank', 'GTBank statement Jan-Dec 2025.pdf', 'bank_statement', 'upload_step'),
      ('deduction:pension',            'Pension contributions 2025.pdf', 'receipt',        'deductions'),
      ('deduction:life_assurance',     'Life assurance premium 2025.pdf', 'receipt',       'deductions'),
      ('deduction:nhf',                'NHF contributions 2025.pdf',     'receipt',        'deductions')
    ) as t(slot, file_name, category, source)
  loop
    with d as (
      insert into public.documents (user_id, storage_path, file_name, mime_type, size_bytes, category, tax_year, source)
      values (u, u || '/' || gen_random_uuid() || '.pdf', doc.file_name, 'application/pdf', 180000, doc.category, 2025, doc.source)
      returning id
    )
    insert into public.filing_documents (filing_id, slot, document_id) select f, doc.slot, id from d;
  end loop;
  perform public.recalculate_filing_tax(f);
end $$;
