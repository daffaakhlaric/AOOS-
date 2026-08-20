-- AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY (Phase 4 -- Go Live) -- 009_go_live.sql
-- Backs the new `modules/go-live` (POST /api/v1/simulation/:id/go-live +
-- POST /api/v1/simulation/:id/rollback) in apps/aaos-api. Same shape convention as 001-008 --
-- snake_case columns, applied against the SAME `simulations` table `001_simulations.sql` created,
-- the SAME Supabase project every other AAOS table lives in.
--
-- COORDINATOR NOTE (docs/PROMPT-AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY.md), section 8's closing
-- paragraph: this schema extension is real, in-scope Go Live work, not incidental plumbing --
-- adding a genuine "LIVE"/"ROLLED_BACK" state and the real ids needed to reconstruct + reverse
-- what Go Live actually did on Meta.
--
-- COLUMN-FOR-COLUMN CONTRACT with `SimulationRow` in
-- src/modules/simulation/infrastructure/simulation.repository.ts (`live_campaign_id`,
-- `live_ad_id`, `live_at`, `rolled_back_at`, `rollback_data`) and with `SimulationStatus` in
-- src/modules/simulation/domain/simulation-record.ts (adds `"LIVE" | "ROLLED_BACK"` to the
-- original `"RUNNING" | "DONE" | "ERROR"` set -- `simulations.status` remains free TEXT, not a
-- CHECK/ENUM, matching every other status-like column in this schema).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/simulation/:id/go-live` (with `GO_LIVE_DRY_RUN=false`) or `.../rollback` can
-- persist a real LIVE/ROLLED_BACK row. With `GO_LIVE_DRY_RUN=true` (the safe default), Go Live
-- still writes to these columns -- a dry run is a real simulation of the sequence, including its
-- own bookkeeping, just with every external Meta/WhatsApp/CAPI call replaced by a `[DRY RUN]`-
-- prefixed `simulation_logs` line (see `go-live.service.ts`).

ALTER TABLE simulations
  ADD COLUMN live_campaign_id TEXT,
  ADD COLUMN live_ad_id       TEXT,
  ADD COLUMN live_at          TIMESTAMPTZ,
  ADD COLUMN rolled_back_at   TIMESTAMPTZ,
  -- Real ids of whatever Go Live's verdict-execution step paused/scaled/fixed (so rollback can
  -- reconstruct exactly what to undo) plus the newly-created campaign/adset/ad ids -- see
  -- `GoLiveRollbackData` in domain/simulation-record.ts for the exact shape written here.
  ADD COLUMN rollback_data    JSONB;

-- Backs GoLiveService's "max 1 Go Live per day" guard: a fast, indexed
-- `WHERE live_at >= <start of today>` scan instead of a full table scan. `live_at` (not
-- `created_at`) is used for this guard -- a simulation can be created on one day and approved/
-- gone-live on another, so `live_at` is the column that actually answers "did a Go Live happen
-- today".
CREATE INDEX idx_simulations_live_at ON simulations(live_at) WHERE live_at IS NOT NULL;
