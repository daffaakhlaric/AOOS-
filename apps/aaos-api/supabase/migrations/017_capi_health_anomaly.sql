-- AAOS-META-MCP-BONUS-TOOLS -- 017_capi_health_anomaly.sql
-- Extends `intelligence_signals` (016_intelligence.sql) with the two REAL signals this pass adds
-- to the SAME real aggregation/Daily Digest `IntelligenceService.refresh()` already builds --
-- never a second, parallel table (per docs/PROMPT-AAOS-META-MCP-BONUS-TOOLS.md's coordinator note
-- point 5).
--
-- `capi_health_data` -- real `@aos/capi-connector` `GetEmqScore` output (Tool 4 / "CAPI Health"),
-- or an honest `{available:false, reasoning}` shape when CAPI isn't configured / the Meta call
-- failed. NEVER the spec's fabricated per-event-type breakdown or issues list -- `EmqReport` only
-- has `pixelId`/`score`/`eventsReceived`/`capturedAt`.
--
-- `anomaly_data` -- real, LOCAL `@aos/meta-ads-agent` `AnomalyDetector.detectFrequencyHigh` output
-- (Tool 1 / "Anomaly Signal", scoped down to `FREQUENCY_HIGH` only -- the only anomaly type
-- honestly computable with zero new historical persistence), or an honest
-- `{available:false, reasoning}` shape. Every other anomaly type from the original spec
-- (SPEND_DROP/SPEND_SPIKE/CPL_INCREASE/CTR_DROP/DELIVERY_ISSUE/LOW_QUALITY_SCORE) is deferred --
-- not computed, not faked with an invented "expected value" baseline.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `IntelligenceService`'s CAPI-health/anomaly fields can persist real data.

ALTER TABLE intelligence_signals
  ADD COLUMN IF NOT EXISTS capi_health_data JSONB,
  ADD COLUMN IF NOT EXISTS anomaly_data      JSONB;
