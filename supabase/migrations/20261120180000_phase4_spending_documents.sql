-- =============================================================================
-- OwnerGC phase 4: spending and documents
--
--   budget_lines   the project's budget, one row per line (seeded from the estimate)
--   documents      every uploaded file: receipts, plans, permits, waivers...
--   expenses       money spent, logged against a budget line, with a receipt
--   change_orders  changes to the price of a budget line, proposed then approved
--   lien_waivers   the signed waiver a sub or supplier gives for each payment
--
-- Plus a private storage bucket, "project-files", for the files themselves.
--
-- Security, same rule as phase 1: you can see a project's rows only if you are a
-- member of the project, and change them only if you are its owner or an editor.
-- Rows can also only point at other rows in the SAME project (the composite
-- foreign keys below), so nobody can attach another customer's receipt to an
-- expense in their own project.
--
-- Money is stored as whole cents (bigint) so sums are never off by a penny.
-- Safe to run more than once.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- budget_lines
-- -----------------------------------------------------------------------------
create table if not exists public.budget_lines (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  -- The estimator's line key ("found", "plum", "cont"...), or null for a line
  -- the person added themselves.
  key           text check (char_length(key) <= 40),
  division      text not null default '' check (char_length(division) <= 10),
  name          text not null check (char_length(name) between 1 and 200),
  budget_cents  bigint not null default 0 check (budget_cents between 0 and 100000000000),
  is_diy        boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (id, project_id),
  unique (project_id, key)
);
create index if not exists budget_lines_project_idx on public.budget_lines (project_id, sort_order);
alter table public.budget_lines enable row level security;

-- -----------------------------------------------------------------------------
-- documents. The file itself lives in storage at projects/{project_id}/{id};
-- storage_path is computed by the database, so it can never point elsewhere.
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects (id) on delete cascade,
  folder         text not null default 'other' check (folder in (
                   'plans', 'permits', 'contracts', 'bids', 'receipts', 'lien_waivers',
                   'change_orders', 'inspections', 'insurance', 'photos', 'other')),
  -- Build phase it belongs to (estimator phase key, e.g. "found"), if any.
  phase          text check (char_length(phase) <= 40),
  title          text not null check (char_length(title) between 1 and 200),
  notes          text check (char_length(notes) <= 2000),
  budget_line_id uuid,
  expires_on     date,
  content_type   text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  size_bytes     bigint not null check (size_bytes between 1 and 26214400),  -- 25 MB
  storage_path   text generated always as ('projects/' || project_id::text || '/' || id::text) stored,
  uploaded_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (id, project_id),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id) on delete set null (budget_line_id)
);
create index if not exists documents_project_idx on public.documents (project_id, folder, created_at desc);
alter table public.documents enable row level security;

-- -----------------------------------------------------------------------------
-- expenses
-- -----------------------------------------------------------------------------
create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  budget_line_id  uuid,
  spent_on        date not null default current_date,
  vendor          text not null check (char_length(vendor) between 1 and 200),
  amount_cents    bigint not null check (amount_cents between 1 and 100000000000),
  note            text check (char_length(note) <= 2000),
  document_id     uuid,
  -- Payments to subs and suppliers need a lien waiver; things like permit fees don't.
  waiver_required boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id) on delete restrict,
  foreign key (document_id, project_id) references public.documents (id, project_id) on delete set null (document_id)
);
create index if not exists expenses_project_idx on public.expenses (project_id, spent_on desc);
create index if not exists expenses_line_idx on public.expenses (budget_line_id);
alter table public.expenses enable row level security;

-- -----------------------------------------------------------------------------
-- change_orders
-- -----------------------------------------------------------------------------
create table if not exists public.change_orders (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  number          integer not null check (number between 1 and 100000),
  budget_line_id  uuid not null,
  title           text not null check (char_length(title) between 1 and 200),
  description     text check (char_length(description) <= 4000),
  vendor          text check (char_length(vendor) <= 200),
  -- Positive adds cost, negative is a credit.
  amount_cents    bigint not null check (amount_cents between -100000000000 and 100000000000),
  status          text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  decided_on      date,
  document_id     uuid,
  created_at      timestamptz not null default now(),
  unique (project_id, number),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id) on delete restrict,
  foreign key (document_id, project_id) references public.documents (id, project_id) on delete set null (document_id)
);
create index if not exists change_orders_line_idx on public.change_orders (budget_line_id);
alter table public.change_orders enable row level security;

-- -----------------------------------------------------------------------------
-- lien_waivers: one per payment (expense)
-- -----------------------------------------------------------------------------
create table if not exists public.lien_waivers (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  expense_id   uuid not null,
  waiver_type  text not null default 'conditional_progress' check (waiver_type in (
                 'conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final')),
  status       text not null default 'requested' check (status in ('requested', 'received')),
  received_on  date,
  document_id  uuid,
  created_at   timestamptz not null default now(),
  unique (expense_id),
  foreign key (expense_id, project_id) references public.expenses (id, project_id) on delete cascade,
  foreign key (document_id, project_id) references public.documents (id, project_id) on delete set null (document_id)
);
alter table public.lien_waivers enable row level security;

-- -----------------------------------------------------------------------------
-- Privileges: nothing for signed-out visitors. Signed-in users may read and
-- write, but never change which project a row belongs to (project_id is left
-- out of every UPDATE grant), and RLS narrows everything to their projects.
-- -----------------------------------------------------------------------------
revoke all on public.budget_lines, public.documents, public.expenses, public.change_orders, public.lien_waivers
  from anon, authenticated;

grant select, insert, delete on public.budget_lines, public.documents, public.expenses, public.change_orders, public.lien_waivers
  to authenticated;

grant update (division, name, budget_cents, is_diy, sort_order) on public.budget_lines to authenticated;
grant update (folder, phase, title, notes, budget_line_id, expires_on) on public.documents to authenticated;
grant update (budget_line_id, spent_on, vendor, amount_cents, note, document_id, waiver_required) on public.expenses to authenticated;
grant update (budget_line_id, title, description, vendor, amount_cents, status, decided_on, document_id) on public.change_orders to authenticated;
grant update (waiver_type, status, received_on, document_id) on public.lien_waivers to authenticated;

-- -----------------------------------------------------------------------------
-- Row-level security: members read, owners and editors write.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['budget_lines', 'documents', 'expenses', 'change_orders', 'lien_waivers'] loop
    execute format('drop policy if exists "Members can read" on public.%I', t);
    execute format('drop policy if exists "Editors can add" on public.%I', t);
    execute format('drop policy if exists "Editors can change" on public.%I', t);
    execute format('drop policy if exists "Editors can delete" on public.%I', t);

    execute format($p$create policy "Members can read" on public.%I for select to authenticated
                      using (private.is_project_member(project_id))$p$, t);
    execute format($p$create policy "Editors can add" on public.%I for insert to authenticated
                      with check (private.can_edit_project(project_id))$p$, t);
    execute format($p$create policy "Editors can change" on public.%I for update to authenticated
                      using (private.can_edit_project(project_id))
                      with check (private.can_edit_project(project_id))$p$, t);
    execute format($p$create policy "Editors can delete" on public.%I for delete to authenticated
                      using (private.can_edit_project(project_id))$p$, t);
  end loop;
end
$$;

-- documents.uploaded_by is always the person uploading.
drop policy if exists "Editors can add" on public.documents;
create policy "Editors can add" on public.documents for insert to authenticated
  with check (private.can_edit_project(project_id) and uploaded_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Storage: a PRIVATE bucket. No public links; the app hands out signed links
-- that expire in a minute. The bucket itself refuses anything that isn't a
-- PDF, JPEG, PNG or HEIC, or is over 25 MB, whatever the browser claims.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-files', 'project-files', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Which project a storage path belongs to: "projects/{project_id}/{document_id}".
-- Returns null for anything else, so junk paths fail the checks below.
create or replace function private.storage_project_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[] := string_to_array(p_name, '/');
begin
  if array_length(parts, 1) <> 3 or parts[1] <> 'projects' then
    return null;
  end if;
  return parts[2]::uuid;
exception when others then
  return null;
end;
$$;

-- A file may only be uploaded to a path that a documents row already claims,
-- in a project the uploader can edit. So every file has a matching row.
create or replace function private.can_upload_file(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = p_name
      and private.can_edit_project(d.project_id)
  );
$$;

revoke all on function private.storage_project_id(text) from public, anon;
revoke all on function private.can_upload_file(text) from public, anon;
grant execute on function private.storage_project_id(text) to authenticated;
grant execute on function private.can_upload_file(text) to authenticated;

drop policy if exists "Project members can read project files" on storage.objects;
drop policy if exists "Project editors can upload project files" on storage.objects;
drop policy if exists "Project editors can delete project files" on storage.objects;

create policy "Project members can read project files" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and private.is_project_member(private.storage_project_id(name)));

create policy "Project editors can upload project files" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and private.can_upload_file(name));

create policy "Project editors can delete project files" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and private.can_edit_project(private.storage_project_id(name)));
-- No update policy: files are never overwritten in place. Upload a new one instead.
