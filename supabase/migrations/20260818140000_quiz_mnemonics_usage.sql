-- 0005_quiz_mnemonics_usage.sql
-- Three additions: multiple-choice options on questions, memory aids, and AI cost tracking.

-- ---------------------------------------------------------------------------
-- 1. Multiple choice
-- ---------------------------------------------------------------------------
--
-- Options live on the question rather than in a separate table. They are generated with
-- the question, in the same call, from the same passage: splitting them apart would mean
-- a second generation that could drift from the answer it is supposed to be distracting
-- from.
--
-- Nullable throughout, because a question generated before this migration has no options
-- and must keep working as a flashcard. Quiz mode simply skips those.

alter table public.questions
  add column if not exists options        text[],
  add column if not exists correct_option smallint;

-- Either both are set or neither is. A half-built multiple choice is a broken screen.
alter table public.questions
  drop constraint if exists questions_options_complete;

alter table public.questions
  add constraint questions_options_complete check (
    (options is null and correct_option is null)
    or (
      options is not null
      and correct_option is not null
      and array_length(options, 1) between 2 and 5
      and correct_option >= 0
      and correct_option < array_length(options, 1)
    )
  );

comment on column public.questions.options is
  'Multiple-choice answers. Null on questions generated before quiz mode existed; those '
  'still work as flashcards.';

-- Quiz mode reads "this project, questions that have options".
create index if not exists questions_project_quiz_idx
  on public.questions (project_id)
  where options is not null;

-- ---------------------------------------------------------------------------
-- 2. Memory aids
-- ---------------------------------------------------------------------------
--
-- For the lists a student has to recall in order under pressure: objectives, research
-- questions, limitations. The aid is the hook; `items` is what it stands for, kept
-- separately so the screen can show the list beside the aid rather than burying it in
-- prose.

create table if not exists public.mnemonics (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  user_id     uuid        not null references auth.users      (id) on delete cascade,

  chapter     smallint,

  -- What the list is, in the student's own words: "Research objectives", "Limitations".
  title       text        not null check (length(trim(title)) > 0),

  -- The list itself, in the order the student should recall it.
  items       text[]      not null check (array_length(items, 1) between 1 and 12),

  -- The aid. A phrase whose initials map to the items, or a short ordered story.
  aid         text        not null check (length(trim(aid)) > 0),

  -- How the aid maps onto the items, so it is learnable rather than just asserted.
  explanation text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.mnemonics is
  'Memory aids for lists a student must recall in order. Built from their own chapters.';

create index if not exists mnemonics_project_idx on public.mnemonics (project_id, chapter);
create index if not exists mnemonics_user_id_idx on public.mnemonics (user_id);

alter table public.mnemonics enable row level security;

create policy "mnemonics_select_own" on public.mnemonics
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "mnemonics_insert_own" on public.mnemonics
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "mnemonics_update_own" on public.mnemonics
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "mnemonics_delete_own" on public.mnemonics
  for delete to authenticated
  using ( (select auth.uid()) = user_id );

drop trigger if exists mnemonics_set_updated_at on public.mnemonics;
create trigger mnemonics_set_updated_at
  before update on public.mnemonics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. AI usage
-- ---------------------------------------------------------------------------
--
-- CLAUDE.md requires usage to be tracked per user and project, because this is multi-user
-- SaaS and model cost has to stay controllable.
--
-- Token counts are nullable, and that is a real limitation rather than an oversight:
-- generation runs through n8n's chainLlm node, which returns the completion but not usage.
-- Swapping that node for a direct HTTP request to OpenRouter would return exact counts.
-- Until then chunks_sent and items_returned are the honest proxies, and they are what
-- actually drives cost here, since prompt size dominates.
--
-- A failed call is still logged. A workflow that times out after sending 40 chunks has
-- cost real money, and a usage table that only records successes will understate the bill
-- exactly when something is going wrong.

create table if not exists public.ai_usage (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users      (id) on delete cascade,
  project_id     uuid                 references public.projects (id) on delete set null,

  -- answer | questions | mnemonics | embed
  operation      text        not null check (length(trim(operation)) > 0),
  model          text,

  prompt_tokens     integer  check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer  check (completion_tokens is null or completion_tokens >= 0),

  -- Proxies for cost while exact token counts are unavailable.
  chunks_sent    integer     check (chunks_sent is null or chunks_sent >= 0),
  items_returned integer     check (items_returned is null or items_returned >= 0),

  duration_ms    integer     check (duration_ms is null or duration_ms >= 0),
  succeeded      boolean     not null default true,
  error          text,

  created_at     timestamptz not null default now()
);

comment on table public.ai_usage is
  'One row per AI call, successful or not. Token counts are null where the provider path '
  'does not return them; chunks_sent is the working proxy for prompt cost.';

create index if not exists ai_usage_user_time_idx    on public.ai_usage (user_id, created_at desc);
create index if not exists ai_usage_project_time_idx on public.ai_usage (project_id, created_at desc);

alter table public.ai_usage enable row level security;

-- A student may read their own usage; nothing in the app lets them write it directly.
-- Inserts happen in server actions under their session, so an insert policy is required.
create policy "ai_usage_select_own" on public.ai_usage
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "ai_usage_insert_own" on public.ai_usage
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );

-- Deliberately no update or delete policy. Usage is an append-only record; a student being
-- able to edit or erase it would defeat the point of keeping it.
