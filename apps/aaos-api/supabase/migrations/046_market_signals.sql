-- AAOS LOOP UPGRADE, Sprint 7 Prompt 18 -- Market Intelligence -- 046_market_signals.sql
-- New table, `modules/market-intelligence` (new module -- MarketIntelligenceService/
-- MarketSignalsRepository), a genuinely SEPARATE cache from `intelligence_signals`
-- (016_intelligence.sql): that table caches Samantha's already-broader Phase 1-4 Intelligence
-- Layer synthesis (seasonal/trends/competitor/inventory/lead/closing + campaign strategy); this
-- one caches ONLY the 4 real external "market signal" sources the spec asks for (search trend,
-- competitor ad angle trend, KPR/BI rate, seasonal calendar), in the exact aggregated shape the
-- spec's own pseudocode describes, refreshed on its own weekly/monthly cadence rather than
-- riding IntelligenceService's daily refresh. Real, additive migration -- no existing table
-- renamed or repurposed.
--
-- Real next migration number verified directly against this folder's actual latest
-- (045_audit_log.sql) before choosing 046 -- no other 046 exists.
--
-- REAL FEASIBILITY PER SOURCE (investigated this dispatch -- see `MarketIntelligenceService`'s own
-- doc for the full reasoning):
--   - `seasonal_data`      -- 100% real, static, zero external dependency (Indonesian THR/Lebaran +
--                             tahun ajaran baru + akhir tahun/pajak calendar). Always `available: true`.
--   - `search_trend_data`  -- REUSES the already-real, already-integrated `@aos/meta-ads-agent`
--                             `GoogleTrendsService` (live when Google Trends' real, unofficial
--                             endpoint is reachable; honestly `available: false` + real reason on
--                             circuit-open/network failure -- never fabricated).
--                             `IntelligenceService.trendsData` did this for the same signal since
--                             016_intelligence.sql -- this table caches the PER-KEYWORD-DELTA shape
--                             this prompt's own spec wants, not that call's single aggregated signal.
--   - `competitor_data`    -- REUSES the already-real `CompetitorIntelService` (Meta Ad Library) --
--                             live only when `META_APP_ID`/`META_APP_SECRET` are configured, same
--                             honest `available: false` degrade `IntelligenceService.competitorData`
--                             already establishes otherwise.
--   - `kpr_rate_data`      -- HONESTLY DEGRADED by default: no real, stable, key-based public
--                             API/RSS feed for Bank Indonesia's 7-Day Reverse Repo Rate was found
--                             during this dispatch (BI's real rate page is HTML meant for humans,
--                             not a documented API). `available: true` only once an operator fills
--                             in the real, manually-curated `MARKET_INTEL_KPR_RATE_*` env vars (see
--                             `AaosApiConfig`'s own doc comment) -- `available: false` + an honest
--                             reason otherwise. Never a fabricated rate.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `MarketIntelligenceService.refresh`/`.getLatest` can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE market_signals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            TEXT NOT NULL,
  vertical             TEXT NOT NULL CHECK (vertical IN ('AUTOMOTIVE', 'PROPERTY')),

  -- Each of the 4 real per-source payloads below is a discriminated `{available: true, ...} |
  -- {available: false, reason: string}` JSON shape (see `domain/market-signals.ts`'s own types) --
  -- honest per-source degrade, never a fabricated whole-row failure when one source is down (same
  -- discipline `intelligence_signals`' own per-source columns already establish).
  search_trend_data       JSONB NOT NULL,
  competitor_data         JSONB NOT NULL,
  kpr_rate_data            JSONB NOT NULL,
  seasonal_data            JSONB NOT NULL,

  -- Real, generated-at-write-time Indonesian summary of the 4 sources above -- the "Sinyal Pasar"
  -- card's own fallback text plus the Kalender Aktivitas result summary, same
  -- `intelligence_signals.digest_text` precedent.
  digest_text          TEXT,

  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_signals_tenant_generated ON market_signals(tenant_id, generated_at DESC);

-- RLS -- mirrors `045_audit_log.sql`'s real policy SHAPE exactly (same `auth.jwt() ->
-- 'user_metadata'` convention). SELECT only -- the real writer is
-- `MarketIntelligenceService`/`MarketSignalsRepository`, which goes through aaos-api's own
-- service-role Supabase client (the SAME `SUPABASE_CLIENT` every other aaos-api-owned table's
-- writer uses), never the anon-key browser client.
ALTER TABLE market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_market_signals" ON market_signals
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- Seed the MARKET_INTELLIGENCE_REFRESH Kalender event -- a real "WEEKLY" recurrence (the spec's
-- own "jalan mingguan via cron" cadence for search_trend/competitor_ads/seasonality; kpr_rate's
-- own slower-changing nature is handled inside `MarketIntelligenceService.buildKprRateSignal`
-- itself re-using the same weekly-cached row rather than a second, parallel monthly cron -- see
-- that method's own doc), checked by the SAME generic `calendar_events` due-window cron every
-- other event type already uses (`SchedulerService.checkAndRunDueEvents`), not a second, parallel
-- `@Cron`. No new recurrence type needed -- `"WEEKLY"` already exists
-- (`scheduler/domain/calendar-event.ts`'s `CalendarEventRecurrence`).
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, created_by)
VALUES
  ('MARKET_INTELLIGENCE_REFRESH', 'Refresh Sinyal Pasar',
   'Tarik search trend, angle kompetitor, rate KPR, dan kalender musiman untuk konteks Samantha',
   (date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '7 hours'), 'WEEKLY', 'system');
