-- EYVRA -- SAMANTHA V2, Phase 1 Part B (second half) -- 055_growth_objective_forecast.sql
--
-- REAL GAP THIS CLOSES: `POST /api/v1/growth-objectives/:id/analyze` (`GrowthObjectivesService.analyze`)
-- computes a real `{reverseFunnel, feasibility}` forecast for one objective (Reverse Funnel math +
-- Feasibility assessment, both pure domain functions over real historical `leads`/`meta_insights_daily`
-- data) but `growth_objectives` (`054_growth_objectives.sql`) has nowhere to persist that result --
-- until now every `GET /:id` would force a client to re-trigger `/analyze` just to see the last
-- computed forecast.
--
-- `forecast JSONB` -- the real `{reverseFunnel: ReverseFunnelResult, feasibility: FeasibilityResult}`
-- object `GrowthObjectivesService.analyze` computes (see `domain/reverse-funnel.ts`/`domain/feasibility.ts`).
-- Nullable, `NULL` until `/analyze` has actually been called at least once for this objective --
-- never a fabricated default forecast for an objective nobody has analyzed yet.
--
-- `forecast_computed_at TIMESTAMPTZ` -- when that stored `forecast` was actually computed, so a
-- client can tell a fresh forecast from a stale one (e.g. computed before the objective's own
-- `target_value`/`end_date` were later edited). Also nullable, `NULL` until the first `/analyze` call.
--
-- Both additive, nullable -- no backfill needed, no existing row is affected.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `GrowthObjectivesService.analyze` can persist real data.

ALTER TABLE growth_objectives
  ADD COLUMN IF NOT EXISTS forecast JSONB,
  ADD COLUMN IF NOT EXISTS forecast_computed_at TIMESTAMPTZ;
