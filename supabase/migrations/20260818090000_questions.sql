-- 0004_questions.sql
-- Phase 4: the questions a panel would actually ask, generated from the student's own work.
--
-- Every question is grounded: it carries the chunk ids it was written from, so a flashcard
-- can show where in the project the answer lives, and a wrong answer can be traced back to
-- the passage the student should reread. A question with no source is a question this
-- product has no business asking - it would be general knowledge wearing a project's name.
--
-- Review state lives on the same row rather than in a separate table. There is exactly one
-- student per question (they are generated per project, not shared), so a join would buy
-- nothing.

create table if not exists public.questions (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        not null references public.projects (id) on delete cascade,
  user_id      uuid        not null references auth.users      (id) on delete cascade,

  -- Which chapter this came from. Null when the source chunks span several, or when the
  -- document it came from was never assigned a chapter.
  chapter      smallint,

  question     text        not null check (length(trim(question)) > 0),

  -- What the student's own project says in answer. Not a marking scheme - it is the
  -- passage's substance, so they can check themselves against their work rather than
  -- against the model's opinion.
  model_answer text        not null check (length(trim(model_answer)) > 0),

  -- The chunks this was written from. Not a foreign key: chunks are rebuilt wholesale on
  -- re-upload, and a question surviving with a stale reference is better than one deleted
  -- because its paragraph moved.
  source_chunk_ids uuid[]  not null default '{}',

  -- 1 recall, 2 explain, 3 defend. Roughly the escalation a real panel follows: what did
  -- you do, why did you do it, why should we accept it.
  difficulty   smallint    not null default 2 check (difficulty between 1 and 3),

  -- ---- review state -------------------------------------------------------
  times_seen   integer     not null default 0 check (times_seen >= 0),
  last_seen_at timestamptz,

  -- The student's own call after seeing the answer: 1 shaky, 2 getting there, 3 solid.
  -- Null until they have judged it once. This is what the readiness score will be built
  -- from in Phase 5, so it is deliberately the student's honest self-report rather than a
  -- machine score.
  confidence   smallint    check (confidence is null or confidence between 1 and 3),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.questions is
  'Defense questions generated from a student''s own chapters. Grounded: each row carries '
  'the chunk ids it was written from.';

comment on column public.questions.confidence is
  'The student''s self-assessment after seeing the answer, 1-3. Null until first reviewed. '
  'Phase 5 readiness is computed from these, not from a machine grade.';

-- Study screens read "this project, weakest first, least recently seen first".
create index if not exists questions_project_review_idx
  on public.questions (project_id, confidence nulls first, last_seen_at nulls first);

create index if not exists questions_project_chapter_idx
  on public.questions (project_id, chapter);

create index if not exists questions_user_id_idx
  on public.questions (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.questions enable row level security;

create policy "questions_select_own" on public.questions
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- Insert additionally proves the parent project belongs to the same student, so questions
-- cannot be attached to someone else's project by supplying its id.
create policy "questions_insert_own" on public.questions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "questions_update_own" on public.questions
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "questions_delete_own" on public.questions
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep ownership honest
-- ---------------------------------------------------------------------------
--
-- Mirrors chunks_inherit_document(): user_id is derived from the parent project rather
-- than trusted from the client, so a mismatched pair cannot be written even by server-side
-- code that is not going through RLS.

create or replace function public.questions_inherit_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select p.user_id into owner
    from public.projects p
   where p.id = new.project_id;

  if owner is null then
    raise exception 'project % does not exist', new.project_id;
  end if;

  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists questions_inherit_project on public.questions;
create trigger questions_inherit_project
  before insert or update of project_id on public.questions
  for each row execute function public.questions_inherit_project();
