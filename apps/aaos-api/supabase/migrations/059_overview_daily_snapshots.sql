-- EYVRA SAMANTHA V2 + KAI V2 Phase 56 (Command Center "Performance Overview" chart) --
-- 059_overview_daily_snapshots.sql. Real next migration number verified directly against this
-- folder's actual latest (058_campaign_creation_requests.sql) before choosing 059 -- no other 059
-- exists.
--
-- REAL GAP THIS CLOSES: `CommandCenterClient.tsx`'s own class doc previously documented an honest
-- omission -- "Performance Overview" (Spend/Leads over time) was rendered as no `Card` at all,
-- because this codebase had never stored a daily spend/leads snapshot, only live, on-demand Meta
-- pulls (`OverviewService.getCampaignsSummary`/`getLeadsSummary`, both point-in-time, no history).
-- This table is the first durable, per-tenant-per-day record of those SAME two real numbers, written
-- once daily by the new `OverviewSnapshotCronService`:
--   - `total_spend`: sum of every real campaign's `spend` for the tenant, over the SAME
--     `MetaAdsService.pullCampaigns` call (same `datePreset`, same multi-ad-account aggregation)
--     `OverviewService.getCampaignsSummary` already uses for the Command Center KPI strip.
--   - `total_leads`: the SAME real CRM lead count (`hot + warm + cold`, `LeadsService.getLeadsByBranch`
--     fanned out across every real branch) already shown by the Command Center KPI strip's own
--     `totalLeads` calculation -- NOT Meta's ad-conversion "leads" metric.
--
-- WHY NOT REUSE `meta_insights_daily` (050_meta_sync.sql): that table already accumulates a daily
-- Meta-reported `spend`/`leads` history via `MetaSyncCronService.runDailySnapshot`, but its `leads`
-- column is Meta's own ad-conversion count (a lead-form/CAPI conversion event) -- a DIFFERENT real
-- number from this app's own CRM lead count that every other leads figure on this exact page already
-- uses. Charting Meta's ad-conversion "leads" next to this app's own CRM lead count would silently
-- mix two different definitions of "a lead" on one chart -- this new table instead stores the SAME
-- real CRM lead count already shown elsewhere on Command Center, for one consistent, honest chart.
--
-- IDEMPOTENCY: `UNIQUE (tenant_id, snapshot_date)` -- `OverviewSnapshotRepository.upsert` conflicts
-- on this pair, so running the daily cron twice for the same UTC day (a retry, a redeploy) overwrites
-- the same row rather than creating a duplicate or double-counting.
--
-- Real `tenant_id TEXT` convention (see `049_meta_oauth_foundation.sql`'s header note #1) -- the
-- slug column every other tenant-scoped table in this folder uses, never `tenants.id`.
--
-- No dashboard UI ever queries this table directly (unlike `audit_log`/`market_signals`) -- it is
-- read exclusively through `aaos-api`'s own `GET /api/v1/overview/timeseries` endpoint, via the
-- shared service-role Supabase client every other table's writer in this app already uses. Same
-- "RLS enabled, zero policies (deny-all to anon/authenticated)" convention `oauth_states`
-- (049_meta_oauth_foundation.sql) already establishes for a table with the identical real-world
-- access shape.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `OverviewSnapshotRepository` can persist a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS overview_daily_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  total_spend   NUMERIC NOT NULL DEFAULT 0,
  total_leads   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_overview_daily_snapshots_tenant_date
  ON overview_daily_snapshots(tenant_id, snapshot_date);

ALTER TABLE overview_daily_snapshots ENABLE ROW LEVEL SECURITY;
