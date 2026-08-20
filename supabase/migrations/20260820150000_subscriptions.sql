-- 0007_subscriptions.sql
-- Paid access, bought per defense rather than per month.
--
-- A student defends once. They prepare hard for a few weeks and never open the product
-- again, so access is a window sized to the preparation period rather than a recurring
-- charge that depends on people forgetting to cancel. See docs/monetisation-plan.md.
--
-- The security shape here is different from every other table in this schema, and
-- deliberately so. Everywhere else the student writes their own rows under RLS. Here the
-- student may only READ. Rows are written by the Paystack webhook, which arrives with no
-- session at all - so it authenticates by signature and runs with the service-role key.
-- A student who can write this table can grant themselves premium.

create table if not exists public.subscriptions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,

  plan          text        not null check (plan in ('free','proposal','full')),
  status        text        not null default 'active'
                            check (status in ('active','expired','refunded')),

  starts_at     timestamptz not null default now(),
  -- Null only for free, which never expires.
  expires_at    timestamptz,

  -- Paystack's reference for the transaction, and what was actually charged. Both stored
  -- rather than recomputed: prices change, and a receipt has to say what was paid at the
  -- time, not what the tier costs today.
  reference     text        unique,
  amount_kobo   integer     check (amount_kobo is null or amount_kobo >= 0),
  currency      text        not null default 'NGN',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.subscriptions is
  'Paid access windows. Written only by the payment webhook; students may read their own.';

comment on column public.subscriptions.reference is
  'Paystack transaction reference. Unique, so a retried webhook is a no-op rather than a '
  'second window.';

-- The lookup every guarded action makes: this student, active, not expired.
create index if not exists subscriptions_user_active_idx
  on public.subscriptions (user_id, status, expires_at desc);

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using ( (select auth.uid()) = user_id );

-- Deliberately no insert, update or delete policy for students. Not an oversight: the only
-- writer is the webhook, using the service-role key, after verifying Paystack's signature.

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- What plan is this student on right now
-- ---------------------------------------------------------------------------
--
-- One place that answers it, so no caller has to remember that an active row with a past
-- expires_at is not actually active. Security invoker, so it can only ever see the
-- caller's own rows.

create or replace function public.current_plan()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (
      select s.plan
        from public.subscriptions s
       where s.user_id = (select auth.uid())
         and s.status = 'active'
         and (s.expires_at is null or s.expires_at > now())
       -- Highest tier wins where windows overlap: a student who upgraded mid-preparation
       -- should not be held to the limits of the plan they started on.
       order by case s.plan when 'full' then 3 when 'proposal' then 2 else 1 end desc
       limit 1
    ),
    'free'
  );
$$;

comment on function public.current_plan() is
  'The caller''s effective plan, defaulting to free. Highest tier wins on overlap.';
