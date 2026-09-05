-- AAOS LOOP UPGRADE, Sprint 6 Prompt 16 -- Fatigue Detection -- 044_creative_packages_fatigue.sql
-- Additive extension of `creative_packages` (003_creative_packages.sql, extended 026/042).
--
-- REAL TABLE CHOICE (investigated, not assumed): the spec named a literal `creative_assets` table.
-- No such table exists anywhere in this codebase. `@aos/asset-library`'s real table is `assets`,
-- but Sprint 5's own investigation (`AssetLibraryClient.tsx`'s own docstring, "Sprint 5 Prompt 14
-- follow-up") already found and documented that a PROPERTY creative package's generated media NEVER
-- reaches `assets` at all -- PROPERTY generation uploads straight to GCS and bypasses
-- `@aos/asset-library` entirely (no `Branch` enum value a PROPERTY listing could honestly carry).
-- `creative_packages` is therefore the one real, PROPERTY-reachable table this feature can attach
-- to -- it already carries the real `listing_id` join key `runPropertyCampaignTriggerCheck`'s own
-- per-listing Meta-campaign match (`matchActiveCampaignForListing`) can be reused against (see
-- `scheduler.service.ts`'s fatigue wiring for the real, honest scope this enables and the real gap
-- it does NOT close -- no `ad_id`/campaign linkage is ever written on this table today, so fatigue
-- is computed per-LISTING, not per-individual-ad-creative).
--
-- Real next migration number verified directly against this folder's actual latest
-- (043_property_objectives_business_context.sql) before choosing 044 -- no other 044 exists.
--
-- `fatigue_status` -- NORMAL (default, every pre-existing row) | WARNING | FATIGUED. See
-- `apps/aaos-api/src/modules/scheduler/domain/fatigue.ts`'s own doc for the real, honest thresholds
-- and the real degrade this phase's own investigation required: this codebase has NO historical/
-- time-series metrics storage anywhere (confirmed, same finding `IntelligenceService`'s own
-- `buildAnomalyContext` doc and Sprint 5's Metrics tab work both already documented) -- a true
-- "CTR 7 hari terakhir vs 7 hari sebelumnya" trend is NOT honestly computable today. `FATIGUED`
-- (which the spec defines as requiring BOTH `frequency > 3.5` AND a confirmed CTR drop) can
-- therefore never be reached from real data by this phase's wiring -- only `WARNING` (frequency
-- alone, per `evaluateFatigue`'s own doc) is ever set by the real scheduler today. The `FATIGUED`
-- value/UI path is still built (schema, badge, banner, recommendation) so it activates for real the
-- moment this app gains a real CTR time series, rather than needing a second migration later.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `SchedulerService`'s fatigue check can persist a real, non-default value.

ALTER TABLE creative_packages
  ADD COLUMN fatigue_status TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (fatigue_status IN ('NORMAL', 'WARNING', 'FATIGUED'));

CREATE INDEX idx_creative_packages_fatigue_status ON creative_packages(fatigue_status)
  WHERE fatigue_status <> 'NORMAL';
