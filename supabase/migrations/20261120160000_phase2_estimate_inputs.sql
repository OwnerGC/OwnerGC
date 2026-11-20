-- =============================================================================
-- OwnerBuilder phase 2: saved estimates
--
-- The estimator saves its inputs (square footage, finish, region, land, DIY
-- choices) into projects.inputs. The app checks them on the server, but the
-- database also refuses anything that isn't a small JSON object, so nobody can
-- stuff megabytes of junk into a project by calling the API directly.
-- =============================================================================

alter table public.projects
  add constraint projects_inputs_small_object
  check (jsonb_typeof(inputs) = 'object' and pg_column_size(inputs) <= 8192);
