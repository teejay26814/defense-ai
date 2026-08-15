-- 0001_profiles.sql
-- Phase 1: user profiles.
--
-- This is the first table in the project and it establishes the security pattern that
-- every later table must follow: RLS enabled, and every policy scoped so a student can
-- only ever reach their own rows. Project data (documents, chunks, questions, answers)
-- will follow the same shape, scoped by user_id and project_id.

create table if not exists public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  full_name   text,
  institution text,
  department  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Student profile, one row per auth user. Created automatically on signup.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

-- A student can read only their own profile.
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ( (select auth.uid()) = id );

-- A student can update only their own profile.
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using      ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- Insert is normally handled by the trigger below (which runs as definer), but this
-- policy keeps a client-side upsert from silently failing, still scoped to self.
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ( (select auth.uid()) = id );

-- Deliberately no DELETE policy: profiles are removed by the cascade from auth.users
-- when the account itself is deleted. Students cannot delete profile rows directly.

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, institution, department)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name',   ''),
    nullif(new.raw_user_meta_data ->> 'institution', ''),
    nullif(new.raw_user_meta_data ->> 'department',  '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates a public.profiles row whenever a new auth.users row is inserted.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
