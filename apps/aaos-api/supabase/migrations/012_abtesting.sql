-- AAOS-ABTESTING-LOOKALIKE -- 012_abtesting.sql
-- Backs `modules/abtesting`'s AbTestingService/AbTestRepository/AbTestVariantRepository. Applied
-- against the SAME Supabase project every other AAOS table lives in (see app.module.ts's
-- `SUPABASE_CLIENT` wiring) -- same convention as 001-011: snake_case columns,
-- `gen_random_uuid()` primary keys, `TIMESTAMPTZ` timestamps.
--
-- These two tables live HERE (in apps/aaos-api's own migration folder), not in any package --
-- `ab_tests`/`ab_test_variants` are new, aaos-api-owned concepts with no real backing in any
-- `@aos/*` package (coordinator note section 7). `ab_test_variants.creative_package_id`
-- FK-references `creative_packages(id)` (003_creative_packages.sql, same project) since each
-- variant's creative really is one row in that table, generated through the existing
-- CreativePackagesService/Kai pipeline (coordinator note section 2) -- no second creative
-- generation path is invented here.
--
-- COLUMN-FOR-COLUMN CONTRACT with `AbTestRow`/`AbTestVariantRow` in
-- src/modules/abtesting/infrastructure/*.ts. Any future column MUST be added there too.
--
-- Depends on 011_calendar_interval_hours.sql having already run (this migration's seed INSERT
-- below writes an `INTERVAL_HOURS` calendar_events row).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `AbTestingService`'s endpoints can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE ab_tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL DEFAULT 'dss-motor',
  name                TEXT NOT NULL,
  campaign_id         TEXT NOT NULL,        -- Meta campaign ID being tested
  ad_set_id           TEXT NOT NULL,        -- Meta ad set ID the variant ads are created under
  page_id             TEXT NOT NULL,        -- Facebook Page ID required by CreateAd's object_story_spec
  wa_link             TEXT NOT NULL,        -- manager-supplied wa.me link, used for IMAGES_ONLY variant creatives
  mode                TEXT NOT NULL DEFAULT 'AUTO', -- 'AUTO'|'MANUAL'
  -- DRAFT (creatives generating) -> RUNNING (ads live on Meta) -> COMPLETE (winner declared)
  -- A test can also end PAUSED (manager-paused) or FAILED (a variant's creative generation failed).
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  threshold_spend     BIGINT NOT NULL DEFAULT 100000,  -- Rp 100.000, combined variant spend
  threshold_days      INTEGER NOT NULL DEFAULT 3,
  min_margin_pct      NUMERIC NOT NULL DEFAULT 20,     -- winner must beat runner-up rph_lead by this %
  auto_pause_loser    BOOLEAN NOT NULL DEFAULT true,
  auto_scale_winner   BOOLEAN NOT NULL DEFAULT true,
  winner_variant_id   UUID,
  winner_rph_lead     NUMERIC,
  improvement_pct     INTEGER,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  failed_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ab_test_variants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ab_test_id           UUID NOT NULL REFERENCES ab_tests(id),
  tenant_id            TEXT NOT NULL DEFAULT 'dss-motor',
  variant_label        TEXT NOT NULL,  -- 'A', 'B', 'C'
  angle                TEXT NOT NULL,  -- a real @aos/meta-ads-agent AdAngle member
  creative_package_id  UUID NOT NULL REFERENCES creative_packages(id),
  meta_ad_id           TEXT,           -- set once the variant's ad is actually created on Meta
  -- PENDING_CREATIVE (creative_packages row still GENERATING) -> READY (creative COMPLETE, ad not
  -- yet created) -> RUNNING (ad live) -> WINNER | PAUSED_LOSER (declared) -> FAILED (creative
  -- generation failed or ad creation failed).
  status               TEXT NOT NULL DEFAULT 'PENDING_CREATIVE',
  -- Insights (real, re-pulled every AB_TEST_CHECK run via the same PullCampaignData use case
  -- every other Tamara feature already uses -- see coordinator note section 1).
  spend                BIGINT NOT NULL DEFAULT 0,
  impressions          BIGINT NOT NULL DEFAULT 0,
  clicks               BIGINT NOT NULL DEFAULT 0,
  conversations         INTEGER NOT NULL DEFAULT 0,
  leads                INTEGER NOT NULL DEFAULT 0,
  rph_lead             NUMERIC,
  ctr                  NUMERIC,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_tenant   ON ab_tests(tenant_id);
CREATE INDEX idx_ab_tests_status   ON ab_tests(status);
CREATE INDEX idx_ab_tests_campaign ON ab_tests(campaign_id);
CREATE INDEX idx_ab_variants_test  ON ab_test_variants(ab_test_id);

-- Seed the AB_TEST_CHECK Kalender event (coordinator note section 5) -- runs every 6 hours via the
-- new `"INTERVAL_HOURS"` recurrence, checked by the SAME generic `calendar_events` due-window cron
-- every other event type already uses (`SchedulerService.checkAndRunDueEvents`), not a second,
-- parallel `@Cron`.
INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, recurrence_interval_hours, created_by)
VALUES
  ('AB_TEST_CHECK', 'Monitor A/B Test', 'Cek performa varian A/B test aktif, launch draft, declare winner',
   (NOW() + INTERVAL '6 hours'), 'INTERVAL_HOURS', 6, 'system');
