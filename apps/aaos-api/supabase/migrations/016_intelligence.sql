-- AAOS-TAMARA-INTELLIGENCE-LAYER Phase 4 -- 016_intelligence.sql
-- Backs `modules/intelligence`'s IntelligenceService/IntelligenceSignalsRepository/
-- CompetitorPageRepository. Same convention as 001-015: snake_case columns,
-- `gen_random_uuid()` primary keys, `TIMESTAMPTZ` timestamps, lives in apps/aaos-api's own
-- migration folder (per the wider effort's coordinator note section 7 -- these two tables are new,
-- aaos-api-owned concepts, not backed by any real `@aos/*` package entity).
--
-- `intelligence_signals` -- one row per real Tamara Intelligence run (manual refresh or the
-- TAMARA_INTELLIGENCE_REFRESH Kalender event below). Each `*_data` column holds the REAL,
-- already-computed signal from the matching `packages/meta-ads-agent/src/intelligence/*` service
-- (or an honest "unavailable"/"not composed" shape when that source degraded -- see
-- `IntelligenceService`'s own doc), never a fabricated placeholder. `campaign_strategy` is the
-- real `LlmService.campaignStrategy` output (including its own honest `available:false` shape when
-- OpenAI is unavailable/rate-limited/hallucinated). `digest_text` is a real, generated-at-write-time
-- Indonesian summary, not stored twice elsewhere.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `IntelligenceService`'s endpoints can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE intelligence_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',
  branch_id         TEXT,

  seasonal_data     JSONB,
  trends_data       JSONB,
  competitor_data   JSONB,
  inventory_data    JSONB,
  lead_profile_data JSONB,
  closing_data      JSONB,

  campaign_strategy JSONB,
  digest_text       TEXT,

  generated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_intelligence_signals_tenant     ON intelligence_signals(tenant_id);
CREATE INDEX idx_intelligence_signals_generated  ON intelligence_signals(tenant_id, generated_at DESC);

-- `competitor_pages` -- the real, tenant-managed config source for `CompetitorIntelService`
-- (Phase 2's own docstring: "deliberately just an explicit caller-supplied input ... no hardcoded
-- page IDs"). `GET/POST /api/v1/competitors`, `DELETE /api/v1/competitors/:id` are real Supabase
-- CRUD over this table -- no hardcoded competitor page IDs anywhere in application code.
CREATE TABLE competitor_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'dss-motor',
  name        TEXT NOT NULL,
  page_id     TEXT NOT NULL,
  vertical    TEXT NOT NULL, -- AUTOMOTIVE | PROPERTY, matches @aos/meta-ads-agent's IntelVertical
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitor_pages_tenant ON competitor_pages(tenant_id);
CREATE UNIQUE INDEX idx_competitor_pages_tenant_page ON competitor_pages(tenant_id, page_id);

-- Seed the TAMARA_INTELLIGENCE_REFRESH Kalender event (coordinator note section 7) -- a real
-- "DAILY" recurrence at 06:00, checked by the SAME generic `calendar_events` due-window cron every
-- other event type already uses (`SchedulerService.checkAndRunDueEvents`), not a second, parallel
-- `@Cron`. No new recurrence type needed for this one (same choice as LOOKALIKE_SYNC).
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, created_by)
VALUES
  ('TAMARA_INTELLIGENCE_REFRESH', 'Tamara Intelligence Refresh',
   'Kumpulkan seasonal, trends, kompetitor, stok, lead, dan closing signal, lalu jalankan campaign strategy synthesis',
   (date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '6 hours'), 'DAILY', 'system');
