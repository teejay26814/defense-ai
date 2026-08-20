-- 0006_mock_defense.sql
-- Phase 5: the mock defense, and the first readiness score this product can honestly show.
--
-- What is being graded is the student's ANSWER, measured against what their own project
-- says. Never the project. A supervisor has already approved it, and by the time someone is
-- sitting a mock defense the work is finished - telling them their methodology is thin is
-- both out of scope and cruel. Every column here is about recall and delivery.
--
-- This is also where the dashboard's coverage figure finally gets replaced by something
-- earned. Coverage counts uploads, which is all the earlier phases could honestly know.
-- A readiness score has to come from answers.

create table if not exists public.defense_sessions (
  id            uuid        primary key default gen_random_uuid(),
  project_id    uuid        not null references public.projects (id) on delete cascade,
  user_id       uuid        not null references auth.users      (id) on delete cascade,

  -- Which occasion this sitting rehearses. Mirrors DEFENSE_SCOPES.
  scope         text        not null default 'final'
                            check (scope in ('chapter','proposal','final')),

  status        text        not null default 'in_progress'
                            check (status in ('in_progress','complete','abandoned')),

  -- Null until the sitting is finished. Computed from the answers, never set directly, so
  -- there is no way for a score to exist that no answer supports.
  readiness     smallint    check (readiness is null or readiness between 0 and 100),

  started_at    timestamptz not null default now(),
  completed_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.defense_sessions is
  'One sitting of the mock defense. readiness is computed from its answers when it closes.';

create index if not exists defense_sessions_project_idx
  on public.defense_sessions (project_id, started_at desc);

create index if not exists defense_sessions_user_idx
  on public.defense_sessions (user_id, started_at desc);

-- ---------------------------------------------------------------------------

create table if not exists public.defense_answers (
  id            uuid        primary key default gen_random_uuid(),
  session_id    uuid        not null references public.defense_sessions (id) on delete cascade,
  project_id    uuid        not null references public.projects (id) on delete cascade,
  user_id       uuid        not null references auth.users      (id) on delete cascade,

  -- The question asked. Not a foreign key on purpose: questions are deleted and regenerated
  -- freely, and a past sitting should survive that rather than lose its own history. The
  -- text is therefore stored, not referenced.
  question_id   uuid,
  question      text        not null check (length(trim(question)) > 0),

  -- What the student typed, and what their project actually says. Both kept, because the
  -- value of reviewing a sitting is seeing them side by side.
  answer        text        not null,
  model_answer  text        not null,

  score         smallint    not null check (score between 0 and 100),

  -- Points from their own project that the answer did and did not reach. Phrased in the
  -- generator as things the project says, never as things the student failed to do.
  covered       text[]      not null default '{}',
  missed        text[]      not null default '{}',
  feedback      text,

  answered_at   timestamptz not null default now()
);

comment on column public.defense_answers.missed is
  'Points the student''s own project makes that their answer did not reach. Material to '
  'revisit, never a criticism of the project.';

create index if not exists defense_answers_session_idx
  on public.defense_answers (session_id, answered_at);

create index if not exists defense_answers_user_idx
  on public.defense_answers (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.defense_sessions enable row level security;
alter table public.defense_answers  enable row level security;

create policy "defense_sessions_select_own" on public.defense_sessions
  for select to authenticated using ( (select auth.uid()) = user_id );

create policy "defense_sessions_insert_own" on public.defense_sessions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

create policy "defense_sessions_update_own" on public.defense_sessions
  for update to authenticated
  using      ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "defense_sessions_delete_own" on public.defense_sessions
  for delete to authenticated using ( (select auth.uid()) = user_id );

create policy "defense_answers_select_own" on public.defense_answers
  for select to authenticated using ( (select auth.uid()) = user_id );

-- Insert proves the parent session belongs to the same student, so answers cannot be
-- attached to someone else's sitting by supplying its id.
create policy "defense_answers_insert_own" on public.defense_answers
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.defense_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

-- Deliberately no update policy. An answer is a record of what was said under pressure;
-- being able to revise it afterwards would make the score meaningless.
create policy "defense_answers_delete_own" on public.defense_answers
  for delete to authenticated using ( (select auth.uid()) = user_id );

drop trigger if exists defense_sessions_set_updated_at on public.defense_sessions;
create trigger defense_sessions_set_updated_at
  before update on public.defense_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership, derived rather than trusted
-- ---------------------------------------------------------------------------

create or replace function public.defense_inherit_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if tg_table_name = 'defense_sessions' then
    select p.user_id into owner from public.projects p where p.id = new.project_id;
  else
    select s.user_id, s.project_id into owner, new.project_id
      from public.defense_sessions s where s.id = new.session_id;
  end if;

  if owner is null then
    raise exception 'parent row does not exist';
  end if;

  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists defense_sessions_inherit_owner on public.defense_sessions;
create trigger defense_sessions_inherit_owner
  before insert on public.defense_sessions
  for each row execute function public.defense_inherit_owner();

drop trigger if exists defense_answers_inherit_owner on public.defense_answers;
create trigger defense_answers_inherit_owner
  before insert on public.defense_answers
  for each row execute function public.defense_inherit_owner();

-- ---------------------------------------------------------------------------
-- Closing a sitting
-- ---------------------------------------------------------------------------
--
-- Readiness is computed here rather than in the app so it cannot be passed in. The number
-- has to be derived from answers that exist, or it is not a readiness score, it is a claim.
--
-- Harder questions count for more. A student who can recall their objectives but cannot
-- defend their sampling choice is not as ready as the average would suggest, and the
-- weighting says so: recall 1, explain 2, defend 3 - the same escalation the questions use.

create or replace function public.close_defense_session(session uuid)
returns smallint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result smallint;
begin
  select round(
           coalesce(
             sum(a.score::numeric * w.weight) / nullif(sum(w.weight), 0),
             0
           )
         )::smallint
    into result
    from public.defense_answers a
    left join lateral (
      select coalesce(q.difficulty, 2)::numeric as weight
        from public.questions q
       where q.id = a.question_id
    ) w on true
   where a.session_id = session;

  -- security invoker, so this update is still subject to the caller's RLS: a student can
  -- only ever close their own sitting.
  update public.defense_sessions
     set readiness = result,
         status = 'complete',
         completed_at = now()
   where id = session;

  return result;
end;
$$;

comment on function public.close_defense_session(uuid) is
  'Closes a sitting and computes its readiness from the answers, weighted by question '
  'difficulty. Security invoker, so RLS still applies.';
