-- 0008_generation_jobs.sql
-- Background generation, tracked so the page can poll instead of waiting on the request.
--
-- Question generation genuinely takes 30-90 seconds - it reads up to 40 chunks and writes
-- a dozen questions from them. Netlify kills a normal request at 10 seconds, so running
-- that call inside the server action that the student's browser is waiting on cannot ever
-- work reliably: the platform cuts the connection long before the model replies, the page
-- shows a generic connection-failure screen, and - worse - the call to n8n may already be
-- running and spending real money with nothing to show for it, because the process that
-- would have logged and saved the result was killed before it could.
--
-- The fix moves the slow part out of the request entirely. The server action does the fast,
-- RLS-checked work (auth, plan limit, reading chunks) and then hands off to a Netlify
-- Background Function - which gets up to 15 minutes and answers the browser immediately -
-- to make the actual call to n8n and write the results. This table is how the two halves
-- meet: one row per generation, so the browser can poll "is it done yet" against something
-- durable instead of holding a connection open.

create table if not exists public.generation_jobs (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users      (id) on delete cascade,
  project_id  uuid        not null references public.projects (id) on delete cascade,

  -- Only "questions" today. Kept as a checked text column, not an enum, so mnemonics can
  -- join this same table later without a migration to widen a type.
  operation   text        not null check (operation in ('questions')),

  status      text        not null default 'pending'
                          check (status in ('pending', 'succeeded', 'failed')),

  -- What was asked for (scope, count) - small, and useful for a retry without re-reading
  -- the form. Never chunk text: that would duplicate real project content into a second
  -- table for no reason this one needs.
  params      jsonb       not null default '{}'::jsonb,

  result_count integer    check (result_count is null or result_count >= 0),
  error        text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.generation_jobs is
  'One row per background AI generation, so the page can poll status instead of holding a '
  'request open past Netlify''s function timeout.';

create index if not exists generation_jobs_user_id_idx on public.generation_jobs (user_id);
create index if not exists generation_jobs_project_id_idx on public.generation_jobs (project_id, created_at desc);

alter table public.generation_jobs enable row level security;

-- The student reads their own job while polling. Written first by the server action under
-- their session (insert), then updated by the background function under the service role
-- once it finishes - that update bypasses RLS entirely, which is expected for trusted
-- backend code and is why there is no update policy for the "authenticated" role below.
create policy "generation_jobs_select_own" on public.generation_jobs
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "generation_jobs_insert_own" on public.generation_jobs
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

drop trigger if exists generation_jobs_set_updated_at on public.generation_jobs;
create trigger generation_jobs_set_updated_at
  before update on public.generation_jobs
  for each row execute function public.set_updated_at();
