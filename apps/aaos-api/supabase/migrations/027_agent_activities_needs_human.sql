-- AAOS-KAI-MANUAL-SHOOT-MENU-CLEANUP (Part A) -- 027_agent_activities_needs_human.sql
-- Additive: extends `agent_activities.status`'s real CHECK constraint (021_agent_activities.sql)
-- to also allow `'NEEDS_HUMAN'` -- a genuinely terminal-but-not-success/error/simulated outcome,
-- written by `CreativePackagesService.generateProperty` (`apps/aaos-api/src/modules/
-- creative-packages/creative-packages.service.ts`) when a PROPERTY listing has zero real photos
-- and Kai's automatic creative generation is escalated to a human for a manual shoot instead of
-- silently degrading forever. See `docs/PROMPT-AAOS-KAI-MANUAL-SHOOT-MENU-CLEANUP.md`.
--
-- Every existing real caller/status (RUNNING/SUCCESS/SIMULATED/ERROR) is unaffected -- this widens
-- the allowed set, it never narrows or renames an existing value.
--
-- `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` with the same, Postgres-default-generated name
-- (`<table>_<column>_check`, the name `021_agent_activities.sql`'s inline, unnamed
-- `CHECK (status IN (...))` clause actually receives) -- no other migration in this folder has
-- needed to widen a CHECK constraint before, so this is the first, and it targets that real default
-- name directly rather than inventing a differently-named constraint that would leave the old one
-- in place alongside it.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project the same
-- way every other migration here is applied.

ALTER TABLE agent_activities DROP CONSTRAINT IF EXISTS agent_activities_status_check;

ALTER TABLE agent_activities ADD CONSTRAINT agent_activities_status_check
  CHECK (status IN ('RUNNING', 'SUCCESS', 'SIMULATED', 'ERROR', 'NEEDS_HUMAN'));
