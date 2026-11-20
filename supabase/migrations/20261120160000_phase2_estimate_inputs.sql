-- =============================================================================
-- OwnerGC phase 2: saved estimates
--
-- The estimator saves its inputs (square footage, finish, region, land, DIY
-- choices) into projects.inputs. The app checks them on the server, but the
-- database also refuses anything that isn't a small JSON object, so nobody can
-- stuff megabytes of junk into a project by calling the API directly.
--
-- Safe to run more than once (it does nothing if the rule already exists), in
-- case it was also pasted into the SQL Editor by hand.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'projects_inputs_small_object'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_inputs_small_object
      check (jsonb_typeof(inputs) = 'object' and pg_column_size(inputs) <= 8192);
  end if;
end
$$;
