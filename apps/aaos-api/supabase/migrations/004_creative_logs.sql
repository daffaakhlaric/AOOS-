-- AAOS-CREATIVE-REVIEW -- 004_creative_logs.sql
-- Append-only event log behind the dashboard's "Log Tamara x Kai" tab. Same conventions as
-- 001_simulations.sql's `simulation_logs` and 002_scrape_jobs.sql's `scrape_job_logs`.
--
-- COLUMN-FOR-COLUMN CONTRACT with `CreativeLogRow` in
-- src/modules/creative-packages/infrastructure/creative-log.repository.ts. Any future column MUST
-- be added there in the same change.
--
-- DELIBERATELY NOT a second source of truth for package state: a package's own
-- `status`/`reviewed_at`/`video_url` live on `creative_packages` (003) and are never mirrored
-- here, and nothing reconstructs package state by replaying this table. This is an audit trail of
-- things that actually happened, one row per real event -- a brief really being handed to Kai, a
-- real Kie AI generation really starting/finishing, a real error, a real human decision. There is
-- no synthetic/narrated log line anywhere: if the pipeline didn't do it, there is no row.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE creative_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'dss-motor',
  -- The `creative_packages.id` this event belongs to. Not a FK: the log must survive a package
  -- row being removed, and the first BRIEF_SENT event is written in the same transaction-less
  -- sequence as the package insert.
  package_id  UUID,

  -- 'TAMARA' | 'KAI' | 'KIE_AI' | 'MANAGER' | 'SYSTEM'
  from_agent  TEXT NOT NULL,
  -- 'KAI' | 'KIE_AI' | 'SISTEM' | NULL (an event with no addressee, e.g. a raw error)
  to_agent    TEXT,
  -- 'BRIEF_SENT' | 'GENERATE' | 'COMPLETE' | 'ERROR' | 'APPROVED' | 'REJECTED'
  event_type  TEXT NOT NULL,

  -- Short human-readable Indonesian summary, rendered as the log card's headline.
  message     TEXT NOT NULL,

  -- The real `CreativeBrief` fields as sent to Kai (BRIEF_SENT only).
  brief       JSONB,
  -- Real generated output {videoUrl, imageUrls, copyVariants} (COMPLETE only).
  result      JSONB,
  -- Real error text from the failed pipeline step (ERROR only).
  error       TEXT,
  -- Free-form real facts about the event: {model, sourcePhotosFound, decidedFormat, durationMs,
  -- selectedCopyVariantId, ...}. Only ever populated with values the pipeline actually produced.
  metadata    JSONB,

  ad_id       TEXT,
  stable_id   TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creative_logs_tenant ON creative_logs(tenant_id);
CREATE INDEX idx_creative_logs_package ON creative_logs(package_id);
CREATE INDEX idx_creative_logs_created ON creative_logs(created_at DESC);
CREATE INDEX idx_creative_logs_event_type ON creative_logs(event_type);
