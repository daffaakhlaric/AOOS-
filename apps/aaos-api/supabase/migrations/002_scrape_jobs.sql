-- AAOS-SCRAPER-ASSET-LIBRARY -- 002_scrape_jobs.sql
-- New tables backing `modules/scraper`'s async job lifecycle (POST /api/v1/scraper/run,
-- GET .../jobs/:jobId, GET .../jobs/:jobId/stream). Same shape convention as
-- 001_simulations.sql's `simulations`/`simulation_logs` -- snake_case columns,
-- `gen_random_uuid()` primary keys, `TIMESTAMPTZ DEFAULT NOW()` timestamps, JSONB for the
-- low-volume result blob -- applied against the SAME Supabase project every other AAOS table
-- lives in (see app.module.ts's `SUPABASE_CLIENT` wiring).
--
-- COLUMN-FOR-COLUMN CONTRACT with `ScrapeJobRow` / `ScrapeJobLogRow` in
-- src/modules/scraper/infrastructure/scrape-job.repository.ts. Any future column MUST be added
-- there in the same change.
--
-- Job state is PERSISTED rather than kept in a process-local Map on purpose: a restart or a second
-- replica must not silently lose a running job's progress, and the SSE/poll endpoints read this
-- real persisted state.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/scraper/run` can persist real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- One row per `POST /api/v1/scraper/run` call.
CREATE TABLE scrape_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',

  -- 'FULL' (whole listing, "Scrape Semua Ulang") | 'UNIT' (single-unit re-scrape)
  kind              TEXT NOT NULL DEFAULT 'FULL',
  status            TEXT NOT NULL DEFAULT 'RUNNING',  -- RUNNING | DONE | ERROR

  -- Requested target. `unit_url` is set for a UNIT job only. `branch` records the branch filter the
  -- caller asked for, purely for the job history -- the underlying `RunFullScrape` always parses the
  -- entire mobixbydss.id listing (it has no per-branch listing endpoint to narrow to).
  unit_url          TEXT,
  branch            TEXT,

  -- Real progress counters. `progress_total` stays NULL until the listing has actually been parsed,
  -- so the dashboard shows an indeterminate bar rather than a fabricated denominator.
  progress_current  INTEGER NOT NULL DEFAULT 0,
  progress_total    INTEGER,

  -- ScrapeJobResult: real measured counts (units scraped/new/sold, photos stored/failed, units
  -- persisted). NULL while RUNNING. JSONB per the same rationale as `simulations.result`: a
  -- single-tenant internal tool with no high write volume doesn't warrant a normalized schema.
  result            JSONB,
  error_message     TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_created ON scrape_jobs(created_at DESC);

-- Append-only log of REAL pipeline milestones -- each row corresponds to one thing that actually
-- happened (the listing being parsed, the diff being computed, one unit's photos finishing, the
-- `scraped_units` write, a real error). Never a fabricated per-line progress narration.
CREATE TABLE scrape_job_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  level       TEXT NOT NULL DEFAULT 'INFO',  -- INFO | WARN | ERROR
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scrape_job_logs_job ON scrape_job_logs(job_id, created_at);
