-- AAOS-DASHBOARD-SIMULASI -- 001_simulations.sql
-- New tables backing `modules/simulation` (POST /api/v1/simulation/start, GET .../status,
-- POST .../approve, POST .../reject, GET .../history). Mirrors the column-naming/typing
-- conventions established by @aos/lead-store's own migrations
-- (packages/lead-store/supabase/migrations/001_initial_schema.sql) -- snake_case columns,
-- `gen_random_uuid()` primary keys, `TIMESTAMPTZ DEFAULT NOW()` timestamps -- applied against the
-- SAME Supabase project @aos/lead-store already uses (see app.module.ts's `SUPABASE_CLIENT`
-- wiring: one shared client/connection, new tables, not a second project).
--
-- Coordinator note #7 ("adjust column names/types to match this codebase's existing Supabase
-- migration conventions... logs/results as JSONB is reasonable for this real but low-traffic
-- internal tool"): both `simulations.result` and every `simulation_logs.payload` are JSONB --
-- this dry-run simulator is a single-tenant internal DSS Motor tool with no expected high write
-- volume, so a normalized per-stage-score schema isn't warranted yet.
--
-- NOT auto-applied by this repo's tooling (same as @aos/lead-store's migrations) -- run this
-- against the real Supabase project (see apps/aaos-api/.env's SUPABASE_URL) before
-- `POST /api/v1/simulation/start` can persist real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One row per `POST /api/v1/simulation/start` call -- the whole 6-step dry-run's persisted state.
CREATE TABLE simulations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',

  -- Step 1 (Setup) inputs, recorded verbatim so `GET .../:id/status` and history can show what was
  -- actually simulated without a second round-trip to /api/objective.
  objective_snapshot   JSONB NOT NULL,   -- the ObjectiveDto used to seed the run
  campaign_data_source  TEXT NOT NULL,   -- 'cache' | 'fresh' (spec Step 1 field)
  persona_ids           JSONB NOT NULL,  -- PersonaId[] selected for Step 4/5 (Jessy + Judge)
  branch                TEXT,            -- Branch enum member, when the run is branch-scoped

  -- Pipeline lifecycle.
  status            TEXT NOT NULL DEFAULT 'RUNNING',  -- RUNNING | DONE | ERROR
  current_step      TEXT NOT NULL DEFAULT 'SETUP',    -- SETUP|TAMARA|KAI|JESSY|JUDGE|REVIEW
  -- Full StoredSimulationResult (per-stage real responses + computed overall score/grade/verdict)
  -- -- see modules/simulation/domain/SimulationRecord.ts for the exact shape. NULL while RUNNING.
  result            JSONB,
  error_message     TEXT,

  -- Step 6 (Review & Approve) -- coordinator note / hard scope boundary: recording ONLY, no
  -- Meta/WhatsApp/CAPI side effects.
  decision          TEXT,             -- APPROVED | REJECTED, NULL until reviewed
  decided_by        TEXT,
  decision_notes    TEXT,
  decided_at        TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_simulations_status ON simulations(status);
CREATE INDEX idx_simulations_created ON simulations(created_at DESC);

-- Append-only real-event log for the status panel's "log" view (coordinator note: never a
-- fabricated per-line log -- every row here corresponds to one real thing that actually happened:
-- a stage starting, a real HTTP/in-process call returning, a real error).
CREATE TABLE simulation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id   UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
  step            TEXT NOT NULL,     -- SETUP|TAMARA|KAI|JESSY|JUDGE|REVIEW
  level           TEXT NOT NULL DEFAULT 'INFO',  -- INFO | WARN | ERROR
  message         TEXT NOT NULL,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_simulation_logs_simulation ON simulation_logs(simulation_id, created_at);
