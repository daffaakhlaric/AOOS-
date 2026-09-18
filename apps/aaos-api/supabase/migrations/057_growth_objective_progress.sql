-- EYVRA -- SAMANTHA V2, Phase 8 -- 057_growth_objective_progress.sql
--
-- REAL GAP THIS CLOSES: `POST /api/v1/growth-objectives/:id/check-progress`
-- (`GrowthObjectivesService.checkProgress`) computes a real `ObjectiveProgressResult` for an
-- ACTIVE/ON_TRACK/AT_RISK/OFF_TRACK objective (real achieved Hot Lead count since its own
-- `start_date`, via the pure `domain/objective-progress.ts`) -- but that result had nowhere durable
-- to live beyond the single HTTP response, and the objective's own `status` transition
-- (ACTIVE -> ON_TRACK/AT_RISK/OFF_TRACK/COMPLETED) was the only real trace left behind.
--
-- WHY THIS IS A NEW COLUMN PAIR, NOT A REUSE OF `forecast`/`forecast_computed_at`
-- (`055_growth_objective_forecast.sql`): `forecast` is a real, honest name for a PRE-RUN estimate
-- (`GrowthObjectivesService.analyze`'s `{reverseFunnel, feasibility}`, computed BEFORE the objective
-- starts, over a fixed historical lookback). `progress` is a real, honest name for an IN-FLIGHT
-- READING (`checkProgress`'s `ObjectiveProgressResult`, computed AFTER the objective starts, over
-- its own real `[start_date, today]` window). Writing a progress reading into a column named
-- `forecast` would conflate two genuinely different real concepts under one dishonest label --
-- this migration keeps them apart, same way `PacingResponseDto` (Phase 7) was kept as its own
-- read-only, non-persisted response rather than overloading `forecast` too.
--
-- `progress JSONB` -- the real `ObjectiveProgressResult` object `checkProgress` computes (see
-- `domain/objective-progress.ts`). Nullable, `NULL` until `/check-progress` has actually been called
-- at least once for this objective -- never a fabricated default progress reading.
--
-- `progress_checked_at TIMESTAMPTZ` -- when that stored `progress` was actually computed, so a
-- client can tell a fresh reading from a stale one. Also nullable, `NULL` until the first
-- `/check-progress` call.
--
-- Both additive, nullable -- no backfill needed, no existing row is affected.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `GrowthObjectivesService.checkProgress` can persist real data.

ALTER TABLE growth_objectives
  ADD COLUMN IF NOT EXISTS progress JSONB,
  ADD COLUMN IF NOT EXISTS progress_checked_at TIMESTAMPTZ;
