-- Gabungan migration 042-051 -- jalankan sekali di Supabase SQL Editor.
-- Kalau salah satu blok error "column/table already exists", itu tandanya migration itu
-- sudah pernah jalan sebelumnya -- lanjut saja ke blok berikutnya.

-- 042_creative_packages_ai_recommended.sql
ALTER TABLE creative_packages
  ADD COLUMN ai_recommended BOOLEAN NOT NULL DEFAULT false;

-- 043_property_objectives_business_context.sql
ALTER TABLE property_objectives
  ADD COLUMN avg_deal_value NUMERIC,
  ADD COLUMN target_cpl     NUMERIC,
  ADD COLUMN breakeven_cpl  NUMERIC,
  ADD COLUMN updated_by     TEXT,
  ADD COLUMN updated_at     TIMESTAMPTZ;

-- 044_creative_packages_fatigue.sql
ALTER TABLE creative_packages
  ADD COLUMN fatigue_status TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (fatigue_status IN ('NORMAL', 'WARNING', 'FATIGUED'));

CREATE INDEX idx_creative_packages_fatigue_status ON creative_packages(fatigue_status)
  WHERE fatigue_status <> 'NORMAL';

-- 045_audit_log.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE audit_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL,

  agent              TEXT NOT NULL
                        CHECK (agent IN ('SAMANTHA', 'KAI', 'CLARA', 'KAREN')),

  action_type        TEXT NOT NULL
                        CHECK (action_type IN (
                          'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
                          'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK'
                        )),

  before_state       JSONB,
  after_state        JSONB,

  decided_by         TEXT NOT NULL
                        CHECK (decided_by IN ('ai_auto', 'user_manual')),
  user_id            TEXT,

  mode               TEXT NOT NULL CHECK (mode IN ('DEV', 'LIVE')),

  related_verdict_id TEXT,
  related_brief_id   TEXT,

  reversible         BOOLEAN NOT NULL DEFAULT false,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_created  ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_tenant_agent    ON audit_log(tenant_id, agent);
CREATE INDEX idx_audit_log_reversible      ON audit_log(tenant_id, reversible) WHERE reversible;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_audit_log" ON audit_log
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- 046_market_signals.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE market_signals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            TEXT NOT NULL,
  vertical             TEXT NOT NULL CHECK (vertical IN ('AUTOMOTIVE', 'PROPERTY')),

  search_trend_data       JSONB NOT NULL,
  competitor_data         JSONB NOT NULL,
  kpr_rate_data            JSONB NOT NULL,
  seasonal_data            JSONB NOT NULL,

  digest_text          TEXT,

  generated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_signals_tenant_generated ON market_signals(tenant_id, generated_at DESC);

ALTER TABLE market_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_market_signals" ON market_signals
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

INSERT INTO calendar_events
  (event_type, title, description, scheduled_at, recurrence, created_by)
VALUES
  ('MARKET_INTELLIGENCE_REFRESH', 'Refresh Sinyal Pasar',
   'Tarik search trend, angle kompetitor, rate KPR, dan kalender musiman untuk konteks Samantha',
   (date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '7 hours'), 'WEEKLY', 'system');

-- 047_creative_packages_auto_loop.sql
ALTER TABLE creative_packages
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_loop')),
  ADD COLUMN related_verdict_id TEXT,
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE INDEX idx_creative_packages_source_tenant_created
  ON creative_packages(tenant_id, source, created_at)
  WHERE source = 'auto_loop';

ALTER TABLE property_objectives
  ADD COLUMN max_auto_briefs_per_day INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN auto_approve_creative_brief BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_type_check CHECK (action_type IN (
  'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
  'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK',
  'CREATIVE_BRIEF_CREATED'
));

-- 048_campaign_auto_publish.sql
ALTER TABLE property_objectives
  ADD COLUMN auto_publish_campaign BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN max_budget_increase_pct INTEGER NOT NULL DEFAULT 20;

ALTER TABLE creative_packages
  ADD COLUMN campaign_publish_status TEXT
    CHECK (campaign_publish_status IN ('PUBLISHED', 'PENDING_REVIEW', 'SKIPPED'));

CREATE INDEX idx_creative_packages_campaign_publish_pending
  ON creative_packages(tenant_id, source, status, campaign_publish_status)
  WHERE source = 'auto_loop' AND status = 'PENDING' AND campaign_publish_status IS NULL;

CREATE TABLE loop_runs (
  id                            UUID PRIMARY KEY,
  tenant_id                     TEXT NOT NULL,
  started_at                    TIMESTAMPTZ NOT NULL,
  completed_at                  TIMESTAMPTZ NOT NULL,
  duration_ms                   INTEGER NOT NULL,
  total_verdicts                INTEGER NOT NULL DEFAULT 0,
  total_briefs_auto_generated   INTEGER NOT NULL DEFAULT 0,
  total_assets_generated        INTEGER NOT NULL DEFAULT 0,
  total_campaigns_published     INTEGER NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loop_runs_tenant_created ON loop_runs(tenant_id, created_at DESC);

ALTER TABLE loop_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_loop_runs" ON loop_runs
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- 049_meta_oauth_foundation.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS system_meta_oauth_config (
  id                          TEXT PRIMARY KEY DEFAULT 'default',
  meta_app_id                 TEXT,
  meta_app_secret_encrypted   TEXT,
  wa_config_id                TEXT,
  updated_at                  TIMESTAMPTZ
);

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS meta_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS meta_token_expires_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_connection_source       TEXT NOT NULL DEFAULT 'manual'
    CHECK (meta_connection_source IN ('manual', 'oauth')),
  ADD COLUMN IF NOT EXISTS meta_fb_user_id              TEXT,
  ADD COLUMN IF NOT EXISTS meta_fb_user_name            TEXT;

ALTER TABLE waba_configs
  ADD COLUMN IF NOT EXISTS config_source          TEXT NOT NULL DEFAULT 'manual'
    CHECK (config_source IN ('manual', 'embedded_signup')),
  ADD COLUMN IF NOT EXISTS webhook_verified        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_verified_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_user_id              TEXT,
  ADD COLUMN IF NOT EXISTS fb_user_name            TEXT;

CREATE TABLE IF NOT EXISTS oauth_states (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  state            TEXT UNIQUE NOT NULL,
  redirect_after   TEXT,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_tenant   ON oauth_states(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires  ON oauth_states(expires_at);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS token_refresh_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,

  connection_type  TEXT NOT NULL
                      CHECK (connection_type IN ('meta', 'wa')),

  success          BOOLEAN NOT NULL,
  error_message    TEXT,
  new_expires_at   TIMESTAMPTZ,

  refreshed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_refresh_log_tenant_refreshed
  ON token_refresh_log(tenant_id, refreshed_at DESC);

ALTER TABLE token_refresh_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_token_refresh_log" ON token_refresh_log
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- 050_meta_sync.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS meta_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,
  meta_campaign_id TEXT NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL,
  objective        TEXT NOT NULL,
  spend            NUMERIC NOT NULL DEFAULT 0,
  meta_created_at  TIMESTAMPTZ,
  synced_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, meta_campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_tenant ON meta_campaigns(tenant_id);

CREATE TABLE IF NOT EXISTS meta_adsets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  campaign_id     UUID NOT NULL REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  meta_adset_id   TEXT NOT NULL,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL,
  daily_budget    NUMERIC,
  spend           NUMERIC NOT NULL DEFAULT 0,
  audience_label  TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, meta_adset_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_tenant   ON meta_adsets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON meta_adsets(campaign_id);

CREATE TABLE IF NOT EXISTS meta_ads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,
  adset_id       UUID NOT NULL REFERENCES meta_adsets(id) ON DELETE CASCADE,
  meta_ad_id     TEXT NOT NULL,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL,
  stable_id      TEXT,
  creative_kind  TEXT CHECK (creative_kind IN ('IMAGE', 'VIDEO')),
  creative_ref   TEXT,
  verdict        TEXT,
  synced_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, meta_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_tenant  ON meta_ads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset   ON meta_ads(adset_id);

CREATE TABLE IF NOT EXISTS meta_insights_daily (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                TEXT NOT NULL,

  level                    TEXT NOT NULL CHECK (level IN ('campaign', 'adset', 'ad')),
  campaign_id              UUID REFERENCES meta_campaigns(id) ON DELETE CASCADE,
  adset_id                 UUID REFERENCES meta_adsets(id) ON DELETE CASCADE,
  ad_id                    UUID REFERENCES meta_ads(id) ON DELETE CASCADE,

  date                     DATE NOT NULL,

  spend                    NUMERIC NOT NULL DEFAULT 0,
  impressions              BIGINT  NOT NULL DEFAULT 0,
  clicks                   BIGINT  NOT NULL DEFAULT 0,
  reach                    BIGINT  NOT NULL DEFAULT 0,
  frequency                NUMERIC NOT NULL DEFAULT 0,
  ctr                      NUMERIC NOT NULL DEFAULT 0,
  cpm                      NUMERIC NOT NULL DEFAULT 0,
  cpc                      NUMERIC NOT NULL DEFAULT 0,
  cpl                      NUMERIC NOT NULL DEFAULT 0,
  leads                    BIGINT  NOT NULL DEFAULT 0,
  messaging_conversations  BIGINT  NOT NULL DEFAULT 0,
  actions                  JSONB,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  entity_ref_id UUID GENERATED ALWAYS AS (COALESCE(ad_id, adset_id, campaign_id)) STORED,

  CHECK (
    (level = 'campaign' AND campaign_id IS NOT NULL AND adset_id IS NULL     AND ad_id IS NULL)
    OR
    (level = 'adset'    AND campaign_id IS NOT NULL AND adset_id IS NOT NULL AND ad_id IS NULL)
    OR
    (level = 'ad'        AND campaign_id IS NOT NULL AND adset_id IS NOT NULL AND ad_id IS NOT NULL)
  ),

  UNIQUE (tenant_id, level, entity_ref_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_insights_daily_tenant_date
  ON meta_insights_daily(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_daily_campaign
  ON meta_insights_daily(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_daily_adset
  ON meta_insights_daily(adset_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_insights_daily_ad
  ON meta_insights_daily(ad_id, date DESC);

ALTER TABLE meta_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_adsets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_insights_daily  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_meta_campaigns" ON meta_campaigns
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

CREATE POLICY "manager_view_own_tenant_meta_adsets" ON meta_adsets
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

CREATE POLICY "manager_view_own_tenant_meta_ads" ON meta_ads
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

CREATE POLICY "manager_view_own_tenant_meta_insights_daily" ON meta_insights_daily
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- 051_andromeda_restructure.sql
ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_type_check CHECK (action_type IN (
  'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
  'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK',
  'CREATIVE_BRIEF_CREATED',
  'ANDROMEDA_RESTRUCTURE_DETECTED', 'CAMPAIGN_RESTRUCTURED'
));

-- Ditambahkan sesi ini (bug fix daily_budget CBO) -- belum pernah dibuatkan file migration nomor
-- resmi, tapi ini SQL yang sama yang dibutuhkan supaya kolom campaign-level daily_budget tersedia
-- kalau Anda pernah menambahkannya manual sebelumnya. Kolom ini TIDAK ditambahkan lewat migration
-- SQL -- ia murni computed dari data Meta di aplikasi, tidak perlu ALTER TABLE apapun di sini.
