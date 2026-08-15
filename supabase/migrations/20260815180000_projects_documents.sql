-- 0002_projects_documents.sql
-- Phase 2: projects, their documents, and the private storage bucket behind them.
--
-- Follows the security pattern established by 0001: RLS on from the start, every row
-- scoped by user_id, and no policy that lets a student reach another student's work.
-- Documents carry user_id directly as well as project_id — denormalised on purpose, so a
-- policy can be checked without a join back to projects on every single row.

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null check (length(btrim(title)) between 1 and 300),
  topic         text        check (topic is null or length(topic) <= 2000),
  degree_level  text        check (degree_level in ('undergraduate','masters','phd','other')),
  institution   text        check (institution is null or length(institution) <= 200),
  department    text        check (department is null or length(department) <= 200),
  supervisor    text        check (supervisor is null or length(supervisor) <= 200),
  defense_date  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.projects is
  'One final-year project per row. The centre of the product — everything else hangs off this.';

create index if not exists projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

create policy "projects_select_own" on public.projects
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "projects_update_own" on public.projects
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- Unlike profiles, projects ARE deletable by their owner: a student who uploaded the
-- wrong project must be able to remove it, and the cascade takes the documents with it.
create policy "projects_delete_own" on public.projects
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references public.projects (id) on delete cascade,
  user_id       uuid        not null references auth.users (id)      on delete cascade,

  label         text        not null check (length(btrim(label)) between 1 and 200),
  -- 1-5 map to the five chapters; null covers appendices, proposals, anything else.
  chapter       smallint    check (chapter is null or chapter between 1 and 20),

  file_name     text        not null check (length(file_name) between 1 and 400),
  storage_path  text        not null unique,
  mime_type     text        not null,
  size_bytes    bigint      not null check (size_bytes > 0),

  -- uploaded -> extracting -> ready, or failed with a reason the student can act on.
  status        text        not null default 'uploaded'
                            check (status in ('uploaded','extracting','ready','failed')),
  error_message text,

  -- Populated by extraction. `content` is the plain text the knowledge base will be
  -- built from in Phase 3; it is not chunked or embedded here.
  content       text,
  word_count    integer     check (word_count is null or word_count >= 0),
  page_count    integer     check (page_count is null or page_count >= 0),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.documents is
  'A file belonging to a project. content holds extracted plain text; chunking and '
  'embeddings arrive in Phase 3.';

comment on column public.documents.user_id is
  'Denormalised from projects so RLS can be checked without a join on every row. Kept '
  'honest by documents_owner_matches_project().';

create index if not exists documents_project_id_chapter_idx
  on public.documents (project_id, chapter nulls last, created_at);

create index if not exists documents_user_id_idx
  on public.documents (user_id);

alter table public.documents enable row level security;

-- Every policy checks user_id, and insert additionally proves the parent project belongs
-- to the same student — otherwise a student could attach a document to someone else's
-- project by supplying its id.
create policy "documents_select_own" on public.documents
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "documents_insert_own" on public.documents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "documents_update_own" on public.documents
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "documents_delete_own" on public.documents
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Belt and braces for the denormalised user_id. RLS already blocks the cross-user case,
-- but a future server-side job running with the service-role key would bypass RLS
-- entirely; this constraint still holds there.
create or replace function public.documents_owner_matches_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.user_id = new.user_id
  ) then
    raise exception 'documents.user_id must match the owner of project %', new.project_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_owner_check on public.documents;
create trigger documents_owner_check
  before insert or update of project_id, user_id on public.documents
  for each row execute function public.documents_owner_matches_project();

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
--
-- Private bucket. Files are addressed as <user_id>/<project_id>/<document_id>.<ext>, so
-- the first path segment is the owner and every policy pivots on it. Downloads go
-- through short-lived signed URLs rather than public links.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = false;

drop policy if exists "project_documents_select_own" on storage.objects;
create policy "project_documents_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "project_documents_insert_own" on storage.objects;
create policy "project_documents_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "project_documents_update_own" on storage.objects;
create policy "project_documents_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "project_documents_delete_own" on storage.objects;
create policy "project_documents_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
