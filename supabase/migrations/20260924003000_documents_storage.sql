-- Real document uploads: a private "documents" storage bucket plus a
-- public.documents table describing each file.
--
-- These are sensitive files (bank statements, payslips, invoices,
-- receipts), so:
--   - the bucket is private: no public URLs, ever. The app views a file
--     through a signed URL that expires after a few minutes;
--   - each user can only upload, read and delete files inside their own
--     {user_id}/ folder, and only see, add and delete their own rows;
--   - file paths are {user_id}/{random id}.{ext}, never the original file
--     name (that's kept, for display only, in documents.file_name).
--
-- The size limit and allowed file types are enforced by the Storage server
-- itself, not just the app.
--
-- Safe to run more than once (SQL Editor or `supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. The bucket: private, 10 MB per file, PDF / JPG / PNG / HEIC only
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Who can touch files in the bucket
-- ---------------------------------------------------------------------------
-- Only signed-in users, and only inside their own {user_id}/ folder. There's
-- no update policy, so an uploaded file can never be overwritten or moved:
-- replacing a document means uploading a new file and deleting the old one.
-- Nothing is granted to signed-out (anon) requests.
drop policy if exists "documents: upload into own folder" on storage.objects;
create policy "documents: upload into own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    -- {user_id}/{random uuid}.{ext}: nothing else, so the original file
    -- name can't end up in the path.
    and name ~ (
      '^' || (select auth.uid())::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|heic)$'
    )
  );

drop policy if exists "documents: read own files" on storage.objects;
create policy "documents: read own files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents: delete own files" on storage.objects;
create policy "documents: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- 3. The documents table
-- ---------------------------------------------------------------------------
-- tax_year is a plain year for now; it'll link to a filings table once that
-- exists.
create table if not exists public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  category     text not null,
  tax_year     smallint not null,
  source       text not null,
  created_at   timestamptz not null default now(),
  constraint documents_storage_path_in_own_folder check (split_part(storage_path, '/', 1) = user_id::text),
  constraint documents_file_name_length check (char_length(file_name) between 1 and 255),
  constraint documents_mime_type_valid check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')
  ),
  constraint documents_size_valid check (size_bytes > 0 and size_bytes <= 10485760),
  constraint documents_category_valid check (
    category in ('bank_statement', 'payslip', 'invoice', 'receipt', 'other')
  ),
  constraint documents_tax_year_valid check (tax_year between 2000 and 2100),
  constraint documents_source_valid check (source in ('upload_step', 'deductions', 'documents_tab'))
);

-- The Documents tab lists a user's files newest first.
create index if not exists documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Who can touch rows
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;

-- Signed-out requests get nothing. Signed-in users can read, add and delete
-- rows; they can only ever update the display fields (file_name, category,
-- tax_year) — never user_id, storage_path, or the file's type and size.
revoke all on public.documents from anon, authenticated;
grant select, insert, delete on public.documents to authenticated;
grant update (file_name, category, tax_year) on public.documents to authenticated;

drop policy if exists "documents: read own rows" on public.documents;
create policy "documents: read own rows"
  on public.documents for select to authenticated
  using (user_id = (select auth.uid()));

-- A row can only be added for a file the user has already uploaded to
-- their own folder, and its type and size must match what the Storage
-- server actually stored.
drop policy if exists "documents: add own rows" on public.documents;
create policy "documents: add own rows"
  on public.documents for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from storage.objects o
       where o.bucket_id = 'documents'
         and o.name = storage_path
         and (storage.foldername(o.name))[1] = (select auth.uid())::text
         and o.metadata ->> 'mimetype' = mime_type
         and (o.metadata ->> 'size')::bigint = size_bytes
    )
  );

drop policy if exists "documents: update own rows" on public.documents;
create policy "documents: update own rows"
  on public.documents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "documents: delete own rows" on public.documents;
create policy "documents: delete own rows"
  on public.documents for delete to authenticated
  using (user_id = (select auth.uid()));
