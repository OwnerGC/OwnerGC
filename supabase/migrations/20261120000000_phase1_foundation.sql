-- =============================================================================
-- OwnerBuilder phase 1: profiles, projects, project_members + row-level security
--
-- The rule for the whole app: you can see or change a project's data only if
-- you are a member of that project. Every later table (budget_lines, expenses,
-- documents...) will reuse the helper functions defined here.
-- =============================================================================

-- A schema that the public API never exposes, for helper functions.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- profiles: one row per login, created automatically at sign-up
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text check (char_length(name) <= 200),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- -----------------------------------------------------------------------------
-- projects: a house build. owner_id is always the person who created it.
-- -----------------------------------------------------------------------------
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  address    text check (char_length(address) <= 500),
  inputs     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);
alter table public.projects enable row level security;

-- -----------------------------------------------------------------------------
-- project_members: who can access which project, and how
-- -----------------------------------------------------------------------------
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_id_idx on public.project_members (user_id);
alter table public.project_members enable row level security;

-- -----------------------------------------------------------------------------
-- Helper functions. "security definer" lets them read project_members without
-- tripping over project_members' own security rules (which would loop forever).
-- They only ever answer about the signed-in user, so they leak nothing.
-- -----------------------------------------------------------------------------
create or replace function private.project_role(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.project_members
  where project_id = p_project_id
    and user_id = (select auth.uid());
$$;

create or replace function private.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_role(p_project_id) is not null;
$$;

create or replace function private.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.project_role(p_project_id) in ('owner', 'editor'), false);
$$;

create or replace function private.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.project_role(p_project_id) = 'owner', false);
$$;

-- True when two users share at least one project (lets collaborators see names).
create or replace function private.shares_project_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- New login -> new profile row.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- New project -> its creator becomes the 'owner' member.
create or replace function private.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function private.handle_new_project();

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_new_project() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Table privileges. Signed-out visitors ("anon") get nothing at all.
-- Signed-in users get only the operations listed, and RLS narrows them further.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.projects, public.project_members from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;

grant select, delete on public.projects to authenticated;
grant insert (name, address, inputs, owner_id) on public.projects to authenticated;
grant update (name, address, inputs) on public.projects to authenticated;   -- owner_id can never change

grant select, insert, delete on public.project_members to authenticated;
grant update (role) on public.project_members to authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security policies
-- -----------------------------------------------------------------------------

-- profiles
create policy "Users can read their own profile and their collaborators'"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_project_with(id));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- projects
-- (owner_id check is there so the creator can read the row back in the same
-- statement that creates it, before the owner membership row exists.)
create policy "Members can read their projects"
  on public.projects for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_project_member(id));

create policy "Users can create projects they own"
  on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners and editors can update projects"
  on public.projects for update to authenticated
  using (private.can_edit_project(id))
  with check (private.can_edit_project(id));

create policy "Owners can delete projects"
  on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

-- project_members
create policy "Members can see who else is on their projects"
  on public.project_members for select to authenticated
  using (private.is_project_member(project_id));

create policy "Owners can add editors and viewers"
  on public.project_members for insert to authenticated
  with check (private.is_project_owner(project_id) and role in ('editor', 'viewer'));

create policy "Owners can change collaborator roles"
  on public.project_members for update to authenticated
  using (private.is_project_owner(project_id) and role <> 'owner')
  with check (private.is_project_owner(project_id) and role in ('editor', 'viewer'));

create policy "Owners can remove collaborators, and collaborators can leave"
  on public.project_members for delete to authenticated
  using (
    role <> 'owner'
    and (private.is_project_owner(project_id) or user_id = (select auth.uid()))
  );
