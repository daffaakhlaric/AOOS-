-- AAOS-AI-JUDGE-SELF-IMPROVING (Phase J3) -- 030_learning_proposals_agent_run_id.sql
-- Extends `learning_proposals` (024_learning_proposals.sql) with a second, real, nullable trigger-
-- source FK -- `agent_run_id`, alongside the existing `simulation_id` -- so a LIVE-run-triggered
-- proposal (a real below-threshold `judge_results.scores.overall`, Phase J2, judged from a real
-- `agent_runs` row, Phase J1) can be honestly recorded without forcing a fake `simulations` FK.
--
-- Real next migration number verified directly against this folder's actual latest
-- (029_judge_results.sql) before choosing 030 -- no other 030 exists.
--
-- CONVENTION (documented here, and honored by every real writer -- `LearningService.
-- onSimulationComplete`/`LearningService.onAgentRunJudged`): exactly ONE of `simulation_id` /
-- `agent_run_id` is populated per row, depending on the row's real trigger source -- NEVER both,
-- NEVER neither. A strict `CHECK` constraint enforces this at the database level (not just
-- app-level discipline) so a future bug can't silently write an ambiguous or untraceable row.
--
-- `agent_run_id` REFERENCES the real `agent_runs(id)` table (028_agent_runs.sql) -- both tables
-- live in this app's own `public` schema, same real-FK reasoning `029_judge_results.sql`'s own
-- `run_id` column already documents for itself.
--
-- REAL TENSION, documented rather than silently papered over: `simulation_id`'s existing
-- `ON DELETE SET NULL` (024_learning_proposals.sql) would, for a row it applies to, leave BOTH
-- columns NULL after a delete -- which the strict CHECK below forbids, so that delete would fail
-- with a CHECK violation instead of silently orphaning the proposal. Deliberately accepted, not
-- worked around: `024_learning_proposals.sql`'s own header doc already establishes there is no real
-- delete path for `simulations` in this app today (same true today for `agent_runs`) -- so
-- `agent_run_id` uses plain `ON DELETE RESTRICT` (the Postgres default with no explicit action) to
-- stay consistent with the strict XOR invariant rather than silently violating it in a real-but-
-- unreachable edge case; a genuine future need to delete a judged `agent_runs`/`simulations` row
-- whose proposal must be kept is a real, separate decision for whoever adds that delete path.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LearningService.onAgentRunJudged` can persist a real `agent_run_id`-populated proposal row.

ALTER TABLE learning_proposals
  ADD COLUMN agent_run_id UUID REFERENCES agent_runs(id);

ALTER TABLE learning_proposals
  ADD CONSTRAINT learning_proposals_exactly_one_trigger_source
  CHECK (
    (simulation_id IS NOT NULL AND agent_run_id IS NULL)
    OR (simulation_id IS NULL AND agent_run_id IS NOT NULL)
  );

CREATE INDEX idx_learning_proposals_agent_run ON learning_proposals(agent_run_id);
