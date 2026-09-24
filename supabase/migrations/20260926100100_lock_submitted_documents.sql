-- A document attached to a submitted filing can't be deleted — not the row in
-- public.documents, and not the file in storage. Documents attached only to
-- drafts (or to nothing) can still be deleted; a draft's slot then just
-- becomes empty.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- Is this document part of a filing that's been submitted? security definer so
-- the policies below can ask without going through filings' own policies.
create or replace function public.is_document_locked(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.filing_documents fd
      join public.filings f on f.id = fd.filing_id
     where fd.document_id = p_document_id
       and f.status <> 'draft'
  );
$$;

create or replace function public.is_document_path_locked(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.documents d
      join public.filing_documents fd on fd.document_id = d.id
      join public.filings f on f.id = fd.filing_id
     where d.storage_path = p_storage_path
       and f.status <> 'draft'
  );
$$;

revoke all on function public.is_document_locked(uuid) from public, anon;
revoke all on function public.is_document_path_locked(text) from public, anon;
grant execute on function public.is_document_locked(uuid) to authenticated;
grant execute on function public.is_document_path_locked(text) to authenticated;

drop policy if exists "documents: delete own rows" on public.documents;
create policy "documents: delete own rows"
  on public.documents for delete to authenticated
  using (user_id = (select auth.uid()) and not public.is_document_locked(id));

drop policy if exists "documents: delete own files" on storage.objects;
create policy "documents: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not public.is_document_path_locked(name)
  );
