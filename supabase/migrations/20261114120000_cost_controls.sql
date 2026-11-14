-- 0010_cost_controls.sql
-- Speed limits, daily limits, and a running estimate of what each student costs.
--
-- Plan allowances (src/lib/plans.ts) cap what a student can spend over their whole access
-- window. They do not stop someone burning that allowance in one sitting, or a script
-- hammering the Ask button. This adds the missing layer: every AI request has to claim a
-- slot first, and a slot is refused if the student is going too fast or has hit today's
-- cap for that kind of request.

-- ---------------------------------------------------------------------------
-- The request log
-- ---------------------------------------------------------------------------
--
-- One row per AI request, written *before* the call, so in-flight requests count. That is
-- the difference from ai_usage, which is written after the call returns and so cannot see
-- a burst of requests that are all still running.

create table if not exists public.ai_requests (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  operation   text        not null
              check (operation in ('answer', 'questions', 'mnemonics', 'evaluate', 'defense')),
  created_at  timestamptz not null default now()
);

comment on table public.ai_requests is
  'One row per AI request, claimed before the call. Drives speed and daily limits.';

create index if not exists ai_requests_user_time_idx
  on public.ai_requests (user_id, created_at desc);

alter table public.ai_requests enable row level security;

-- Students may see their own rows. There is deliberately no insert, update or delete
-- policy: the only writer is take_ai_slot() below, so a student can neither forge slots
-- nor delete old ones to reset their limits.
create policy "ai_requests_select_own" on public.ai_requests
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- ---------------------------------------------------------------------------
-- Claiming a slot
-- ---------------------------------------------------------------------------
--
-- Returns null when the request may go ahead (and records it), or a reason code when it
-- may not. Security definer so it can insert into a table students cannot write to, and
-- it only ever acts on auth.uid() - there is no user parameter to abuse.
--
-- The advisory lock serialises one student's concurrent requests, so two clicks in the
-- same instant cannot both see "no recent request" and both pass.
--
-- The daily limit is passed in by the server action, which reads it from plans.ts, so the
-- product numbers live in one place. A student calling this RPC directly with a null limit
-- gains nothing: a slot only matters to the server action that asked for it.

create or replace function public.take_ai_slot(op text, daily_limit integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := auth.uid();
  last_at    timestamptz;
  hour_count integer;
  day_count  integer;
begin
  if uid is null then
    return 'unauthenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  -- Speed limit: one AI request every 5 seconds, across every kind of request.
  select max(created_at) into last_at
    from public.ai_requests
   where user_id = uid;

  if last_at is not null and last_at > now() - interval '5 seconds' then
    return 'too_fast';
  end if;

  -- Hourly ceiling across everything. Generous for a real student, fatal to a script.
  select count(*) into hour_count
    from public.ai_requests
   where user_id = uid
     and created_at > now() - interval '1 hour';

  if hour_count >= 40 then
    return 'hourly';
  end if;

  -- Daily cap for this kind of request, over a rolling 24 hours.
  if daily_limit is not null then
    select count(*) into day_count
      from public.ai_requests
     where user_id = uid
       and operation = op
       and created_at > now() - interval '24 hours';

    if day_count >= daily_limit then
      return 'daily';
    end if;
  end if;

  insert into public.ai_requests (user_id, operation) values (uid, op);
  return null;
end;
$$;

comment on function public.take_ai_slot(text, integer) is
  'Claims an AI request slot for the caller. Null = allowed; otherwise too_fast, hourly, '
  'daily or unauthenticated.';

revoke all on function public.take_ai_slot(text, integer) from public, anon;
grant execute on function public.take_ai_slot(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- What each student is costing, roughly
-- ---------------------------------------------------------------------------
--
-- An estimate, not a bill. The n8n workflows do not report token counts back, so this
-- prices each recorded call from its shape: about 700 tokens per excerpt sent plus the
-- fixed prompt, and a typical reply length per operation, at Claude Sonnet 5.5 rates
-- ($2 in / $10 out per million tokens). Mock-defense marking was logged as 'answer' before
-- this migration and as 'evaluate' after it.
--
-- The real figure is on the OpenRouter dashboard. This exists to spot which students cost
-- the most, from the SQL editor:
--   select * from public.ai_cost_estimate order by est_usd desc;
--
-- Security invoker, so a student querying it through the API sees only their own rows.

create or replace view public.ai_cost_estimate
with (security_invoker = true) as
select
  u.user_id,
  count(*)                                            as calls,
  count(*) filter (where u.operation = 'answer')      as asks,
  count(*) filter (where u.operation = 'questions')   as question_sets,
  count(*) filter (where u.operation = 'mnemonics')   as memory_aid_sets,
  count(*) filter (where u.operation = 'evaluate')    as answers_marked,
  round(sum(
    case u.operation
      when 'answer'    then (coalesce(u.chunks_sent, 8)  * 700 + 700)  * 2.0 + 500  * 10.0
      when 'questions' then (coalesce(u.chunks_sent, 30) * 700 + 1200) * 2.0 + 3000 * 10.0
      when 'mnemonics' then (coalesce(u.chunks_sent, 20) * 700 + 700)  * 2.0 + 1500 * 10.0
      when 'evaluate'  then 1500 * 2.0 + 400 * 10.0
      else 0
    end
  ) / 1000000.0, 3)                                   as est_usd,
  min(u.created_at)                                   as first_call,
  max(u.created_at)                                   as last_call
from public.ai_usage u
where u.operation <> 'embed'
group by u.user_id;

comment on view public.ai_cost_estimate is
  'Rough AI cost per student, estimated from call shape at Sonnet 5.5 rates. Not a bill.';
