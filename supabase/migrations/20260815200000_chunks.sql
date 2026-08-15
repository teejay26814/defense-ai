-- 0003_chunks.sql
-- Phase 3 groundwork: the retrievable pieces of a student's project.
--
-- Vectors live in Pinecone; this table holds the text those vectors point at. That split
-- is deliberate. Pinecone has no row-level security, so if it held the text, isolation
-- between students would rest on application logic alone. Here it stores only an id and
-- an embedding, and every retrieval hydrates the actual content from this table under the
-- student's own session — so RLS still stands between one student and another's work,
-- exactly as CLAUDE.md requires.
--
-- No pgvector extension and no vector column: nothing in Postgres needs to know the
-- embedding dimension, which also means switching embedding models later does not require
-- a schema migration.

create table if not exists public.chunks (
  id           uuid        primary key default gen_random_uuid(),
  document_id  uuid        not null references public.documents (id) on delete cascade,
  project_id   uuid        not null references public.projects  (id) on delete cascade,
  user_id      uuid        not null references auth.users       (id) on delete cascade,

  -- Position of this chunk within its document, 0-based. Ordering these reconstructs the
  -- document, and adjacent chunks can be pulled in to widen context around a hit.
  chunk_index  integer     not null check (chunk_index >= 0),

  content      text        not null check (length(content) > 0),
  token_count  integer     check (token_count is null or token_count >= 0),

  -- Denormalised from documents so a citation can say "Chapter Two" without a join on
  -- every retrieved row. Kept in step by chunks_inherit_document().
  chapter      smallint,
  label        text,

  -- True once this chunk has been embedded and upserted into the vector index. Retrieval
  -- ignores anything still false.
  embedded     boolean     not null default false,
  embedded_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (document_id, chunk_index)
);

comment on table public.chunks is
  'Retrievable pieces of a document. Holds the text; the vector index holds only ids.';

comment on column public.chunks.embedded is
  'Set by the embedding pipeline once the vector exists in the index. Retrieval ignores '
  'rows where this is false.';

create index if not exists chunks_project_embedded_idx
  on public.chunks (project_id, embedded);

create index if not exists chunks_document_order_idx
  on public.chunks (document_id, chunk_index);

create index if not exists chunks_user_id_idx
  on public.chunks (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.chunks enable row level security;

create policy "chunks_select_own" on public.chunks
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- Insert additionally proves the parent document belongs to the same student, so a
-- student cannot attach chunks to someone else's document by supplying its id.
create policy "chunks_insert_own" on public.chunks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

create policy "chunks_update_own" on public.chunks
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "chunks_delete_own" on public.chunks
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

drop trigger if exists chunks_set_updated_at on public.chunks;
create trigger chunks_set_updated_at
  before update on public.chunks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep ownership and citation fields honest
-- ---------------------------------------------------------------------------
--
-- RLS already blocks the cross-student case, but this also holds for a server-side job
-- running with the service-role key, which bypasses RLS entirely. It doubles as the place
-- where chapter and label are copied down, so a citation never has to join.

create or replace function public.chunks_inherit_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc record;
begin
  select d.project_id, d.user_id, d.chapter, d.label
    into doc
    from public.documents d
   where d.id = new.document_id;

  if not found then
    raise exception 'document % does not exist', new.document_id
      using errcode = 'foreign_key_violation';
  end if;

  if new.user_id <> doc.user_id then
    raise exception 'chunks.user_id must match the owner of document %', new.document_id
      using errcode = 'check_violation';
  end if;

  new.project_id := doc.project_id;
  new.chapter    := doc.chapter;
  new.label      := doc.label;

  return new;
end;
$$;

drop trigger if exists chunks_inherit_document on public.chunks;
create trigger chunks_inherit_document
  before insert or update of document_id, user_id on public.chunks
  for each row execute function public.chunks_inherit_document();

-- ---------------------------------------------------------------------------
-- Hydration
-- ---------------------------------------------------------------------------
--
-- The retrieval path: the vector index returns chunk ids, and this returns the text for
-- them. It is deliberately a plain security-invoker function, so the caller's RLS applies
-- — ids belonging to another student simply come back empty rather than raising, which
-- leaks nothing about what exists.

create or replace function public.chunks_by_ids(chunk_ids uuid[])
returns table (
  id          uuid,
  document_id uuid,
  project_id  uuid,
  chunk_index integer,
  chapter     smallint,
  label       text,
  content     text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.document_id, c.project_id, c.chunk_index, c.chapter, c.label, c.content
    from public.chunks c
   where c.id = any(chunk_ids)
     and c.embedded
   order by array_position(chunk_ids, c.id);
$$;

comment on function public.chunks_by_ids(uuid[]) is
  'Hydrates chunk text for ids returned by the vector index. Security invoker on purpose: '
  'the caller''s RLS decides what comes back, so a mis-scoped index cannot leak text.';
