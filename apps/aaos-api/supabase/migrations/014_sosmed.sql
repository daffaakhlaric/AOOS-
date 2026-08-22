-- AAOS-SOSMED-AUTOMATION Phase 1 -- 014_sosmed.sql
-- Backs `modules/sosmed`'s future OAuth/publishing/scheduling work (Phases 2-5). Phase 1 itself
-- only ships the domain/DTO layer + `ScheduledPostRepository` skeleton + the caption/hashtag
-- generation endpoints -- neither table is written to by any Phase 1 endpoint. This migration
-- exists now, ahead of that later code, so the schema is a stable foundation from day one (per
-- the coordinator note's explicit instruction: "Build the full real schema now ... but do NOT
-- build any endpoint that writes a real access_token yet").
--
-- Same convention as 001-013: snake_case columns, `gen_random_uuid()` primary keys, `TIMESTAMPTZ`
-- timestamps, lives in apps/aaos-api's own migration folder (both tables are aaos-api-owned
-- concepts, same precedent as `meta_audiences` in 013_lookalike.sql -- no real backing in any
-- `@aos/*` package).
--
-- COLUMN-FOR-COLUMN CONTRACT with `SosmedAccountRow`/`ScheduledPostRow` shapes documented in
-- src/modules/sosmed/domain/*.ts (no repository reads/writes `sosmed_accounts` yet -- see that
-- file's own doc for why). Any future column MUST be added to those types too.
--
-- access_token custody (coordinator note #2): deliberately NOT addressed by this migration beyond
-- declaring the column -- no Phase 1 code path ever writes a real value into it (there is no OAuth
-- flow yet to produce one safely). Whichever later phase adds the OAuth flow must first verify how
-- `waba_configs.access_token`/`tenants.meta_access_token` are stored/read today and match that
-- existing precedent, per the coordinator note.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- any later-phase `modules/sosmed` code can persist/read real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Connected social media accounts (official + per-sales). No row is ever written by Phase 1 code
-- -- this table exists purely as the stable target for the OAuth flows built in a later phase.
CREATE TABLE sosmed_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL DEFAULT 'dss-motor',
  sales_human_id        UUID REFERENCES sales_humans(id),
  platform              TEXT NOT NULL,   -- FACEBOOK|INSTAGRAM|TIKTOK|YOUTUBE
  account_type          TEXT NOT NULL,   -- OFFICIAL|SALES_PERSONAL
  account_name          TEXT NOT NULL,
  username              TEXT,
  page_id               TEXT,
  instagram_account_id  TEXT,
  access_token          TEXT NOT NULL,
  token_expires_at      TIMESTAMPTZ,
  follower_count        INTEGER NOT NULL DEFAULT 0,
  profile_pic_url       TEXT,
  status                TEXT NOT NULL DEFAULT 'CONNECTED', -- CONNECTED|EXPIRED|ERROR
  last_sync_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scheduled / published posts. `ScheduledPostRepository` (Phase 1) can create/read/list/update
-- rows here, but nothing in Phase 1 calls it from an HTTP endpoint yet -- no publishing pipeline
-- exists to populate `platform_post_id`/insights columns for real until a later phase.
CREATE TABLE scheduled_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL DEFAULT 'dss-motor',
  account_id          UUID REFERENCES sosmed_accounts(id),

  -- Content
  caption             TEXT NOT NULL,
  media_url           TEXT,           -- GCS URL gambar/video (packages/asset-library, later phase)
  media_type          TEXT,           -- IMAGE|VIDEO|CAROUSEL
  hashtags            TEXT[] NOT NULL DEFAULT '{}',

  -- Source
  content_type        TEXT,           -- PROMO|TESTIMONI|EDUKASI|BTS|TIPS|MARKET_UPDATE
  product_id          TEXT,           -- unit ID atau listing ID
  angle               TEXT,

  -- AI generation
  generated_by        TEXT NOT NULL DEFAULT 'TAMARA',
  kai_package_id      TEXT,           -- jika visual dari Kai (later phase)

  -- Schedule
  scheduled_at        TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'DRAFT',
  -- DRAFT|SCHEDULED|PUBLISHING|PUBLISHED|FAILED|CANCELLED

  -- Results
  published_at        TIMESTAMPTZ,
  platform_post_id    TEXT,
  error_message       TEXT,

  -- Insights (sync dari Meta, later phase)
  reach               INTEGER NOT NULL DEFAULT 0,
  impressions         INTEGER NOT NULL DEFAULT 0,
  likes               INTEGER NOT NULL DEFAULT 0,
  comments            INTEGER NOT NULL DEFAULT 0,
  shares              INTEGER NOT NULL DEFAULT 0,
  engagement_count    INTEGER NOT NULL DEFAULT 0,
  insights_synced_at  TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sosmed_accounts_tenant     ON sosmed_accounts(tenant_id);
CREATE INDEX idx_scheduled_posts_tenant     ON scheduled_posts(tenant_id);
CREATE INDEX idx_scheduled_posts_status     ON scheduled_posts(tenant_id, status);
CREATE INDEX idx_scheduled_posts_scheduled  ON scheduled_posts(scheduled_at);
