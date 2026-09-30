-- Made-up complete draft return for the review-screen demo video.
-- Run against a LOCAL/TEST database only, after creating the account
-- demo@example.com (email confirmed) and marking its profile identity_verified.
-- Every name and figure here is invented.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@example.com');
  f uuid; d1 uuid; d2 uuid; d3 uuid; d4 uuid;
begin
  if u is null then raise exception 'Create the demo@example.com account first'; end if;
  delete from public.filings where user_id = u;
  delete from public.documents where user_id = u;
  insert into public.filings (user_id, tax_year, status, current_step, business_expenses_kobo, income_confirmed_at)
    values (u, 2025, 'draft', 'return_review', 0, now()) returning id into f;
  insert into public.filing_income_sources (filing_id, platform, amount_kobo, position, amount_source) values
    (f, 'Paystack', 485000000, 0, 'manual'),
    (f, 'Upwork',   288000000, 1, 'manual');
  insert into public.documents (user_id, storage_path, file_name, mime_type, size_bytes, category, tax_year, source)
    values (u, u || '/demo-paystack.pdf', 'Paystack statement 2025.pdf', 'application/pdf', 120000, 'bank_statement', 2025, 'upload_step') returning id into d1;
  insert into public.documents (user_id, storage_path, file_name, mime_type, size_bytes, category, tax_year, source)
    values (u, u || '/demo-upwork.pdf', 'Upwork statement 2025.pdf', 'application/pdf', 120000, 'bank_statement', 2025, 'upload_step') returning id into d2;
  insert into public.documents (user_id, storage_path, file_name, mime_type, size_bytes, category, tax_year, source)
    values (u, u || '/demo-pension.pdf', 'Pension receipt 2025.pdf', 'application/pdf', 90000, 'receipt', 2025, 'deductions') returning id into d3;
  insert into public.documents (user_id, storage_path, file_name, mime_type, size_bytes, category, tax_year, source)
    values (u, u || '/demo-life.pdf', 'Life assurance receipt 2025.pdf', 'application/pdf', 90000, 'receipt', 2025, 'deductions') returning id into d4;
  insert into public.filing_documents (filing_id, slot, document_id) values
    (f, 'platform:Paystack', d1), (f, 'platform:Upwork', d2), (f, 'deduction:pension', d3), (f, 'deduction:life_assurance', d4);
  insert into public.filing_deductions (filing_id, deduction_type, amount_paid_kobo) values
    (f, 'pension', 48000000), (f, 'life_assurance', 12000000);
  perform public.recalculate_filing_tax(f);
end $$;
