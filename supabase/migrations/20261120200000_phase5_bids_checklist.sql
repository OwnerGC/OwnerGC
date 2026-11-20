-- =============================================================================
-- OwnerGC phase 5: subs, bids, checklist, schedule, selections
--
--   subs        contact book: who to call for each trade, with license and
--               insurance expiry dates
--   bids        a sub's price for a budget line; one can be awarded per line
--   tasks       the build checklist across the phases, inspections flagged
--   selections  finish choices (tile, fixtures...) with allowance vs. real price
--
-- Also: projects.start_date (for the schedule) and documents.sub_id (so a
-- sub's insurance certificate or license can be filed against them).
--
-- Same security rule as before: members read, owners and editors write, and
-- rows can only point at rows in the same project. Only adds things; changes
-- no existing data. Safe to run more than once.
-- =============================================================================

alter table public.projects add column if not exists start_date date;
grant update (start_date) on public.projects to authenticated;

-- -----------------------------------------------------------------------------
-- subs
-- -----------------------------------------------------------------------------
create table if not exists public.subs (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects (id) on delete cascade,
  company              text not null check (char_length(company) between 1 and 200),
  contact_name         text check (char_length(contact_name) <= 200),
  trade                text not null default '' check (char_length(trade) <= 100),
  phone                text check (char_length(phone) <= 40),
  email                text check (char_length(email) <= 200),
  notes                text check (char_length(notes) <= 2000),
  license_number       text check (char_length(license_number) <= 100),
  license_expires_on   date,
  insurance_expires_on date,
  created_at           timestamptz not null default now(),
  unique (id, project_id)
);
create index if not exists subs_project_idx on public.subs (project_id, trade);
alter table public.subs enable row level security;

alter table public.documents add column if not exists sub_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_sub_same_project') then
    alter table public.documents
      add constraint documents_sub_same_project
      foreign key (sub_id, project_id) references public.subs (id, project_id) on delete set null (sub_id);
  end if;
end
$$;
grant update (sub_id) on public.documents to authenticated;

-- -----------------------------------------------------------------------------
-- bids
-- -----------------------------------------------------------------------------
create table if not exists public.bids (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  sub_id          uuid not null,
  budget_line_id  uuid not null,
  amount_cents    bigint not null check (amount_cents between 0 and 100000000000),
  status          text not null default 'received' check (status in ('requested', 'received', 'awarded', 'declined')),
  received_on     date,
  due_on          date,
  notes           text check (char_length(notes) <= 4000),
  document_id     uuid,
  -- Result of the AI bid check (line items, missing scope...), if run.
  ai_review       jsonb check (ai_review is null or (jsonb_typeof(ai_review) = 'object' and pg_column_size(ai_review) <= 65536)),
  ai_reviewed_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, project_id),
  foreign key (sub_id, project_id) references public.subs (id, project_id) on delete restrict,
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id) on delete restrict,
  foreign key (document_id, project_id) references public.documents (id, project_id) on delete set null (document_id)
);
create index if not exists bids_line_idx on public.bids (budget_line_id);
-- At most one awarded bid per budget line.
create unique index if not exists bids_one_award_per_line on public.bids (budget_line_id) where status = 'awarded';
alter table public.bids enable row level security;

-- -----------------------------------------------------------------------------
-- tasks (the checklist)
-- -----------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  phase         text not null check (char_length(phase) between 1 and 40),
  -- Template key ("found.ftg") for tasks from the default checklist; null for your own.
  key           text check (char_length(key) <= 80),
  title         text not null check (char_length(title) between 1 and 200),
  is_inspection boolean not null default false,
  due_date      date,
  done_at       date,
  notes         text check (char_length(notes) <= 2000),
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (project_id, key)
);
create index if not exists tasks_project_idx on public.tasks (project_id, phase, sort_order);
alter table public.tasks enable row level security;

-- -----------------------------------------------------------------------------
-- selections and allowances
-- -----------------------------------------------------------------------------
create table if not exists public.selections (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  budget_line_id  uuid,
  category        text not null default '' check (char_length(category) <= 100),
  item            text not null check (char_length(item) between 1 and 200),
  allowance_cents bigint not null default 0 check (allowance_cents between 0 and 100000000000),
  actual_cents    bigint check (actual_cents between 0 and 100000000000),
  status          text not null default 'choosing' check (status in ('choosing', 'selected', 'ordered', 'installed')),
  vendor          text check (char_length(vendor) <= 200),
  due_on          date,
  notes           text check (char_length(notes) <= 2000),
  document_id     uuid,
  created_at      timestamptz not null default now(),
  foreign key (budget_line_id, project_id) references public.budget_lines (id, project_id) on delete set null (budget_line_id),
  foreign key (document_id, project_id) references public.documents (id, project_id) on delete set null (document_id)
);
create index if not exists selections_project_idx on public.selections (project_id, category);
alter table public.selections enable row level security;

-- -----------------------------------------------------------------------------
-- Privileges (project_id is never updatable) and row-level security
-- -----------------------------------------------------------------------------
revoke all on public.subs, public.bids, public.tasks, public.selections from anon, authenticated;
grant select, insert, delete on public.subs, public.bids, public.tasks, public.selections to authenticated;

grant update (company, contact_name, trade, phone, email, notes, license_number, license_expires_on, insurance_expires_on)
  on public.subs to authenticated;
grant update (sub_id, budget_line_id, amount_cents, status, received_on, due_on, notes, document_id, ai_review, ai_reviewed_at)
  on public.bids to authenticated;
grant update (phase, title, is_inspection, due_date, done_at, notes, sort_order) on public.tasks to authenticated;
grant update (budget_line_id, category, item, allowance_cents, actual_cents, status, vendor, due_on, notes, document_id)
  on public.selections to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['subs', 'bids', 'tasks', 'selections'] loop
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
