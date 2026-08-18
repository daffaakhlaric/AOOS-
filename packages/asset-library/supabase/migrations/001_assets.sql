-- AAOS-SCRAPER-ASSET-LIBRARY -- 001_assets.sql
--
-- The `assets` metadata table backing `@aos/asset-library`'s `AssetRepository`. `AssetRepository`
-- and `AssetMapper` were written in AAOS-W3E and have assumed this table ever since, but nobody
-- had written the `CREATE TABLE` for it -- this is the first real migration for it.
--
-- COLUMN-FOR-COLUMN CONTRACT: every column below corresponds 1:1 to a field of
-- `AssetMapper.AssetRow` (src/infrastructure/mappers/AssetMapper.ts) -- same names, same
-- nullability, same order. There are deliberately NO extra columns. The original spec's
-- `source`/`gcs_path`/`gcs_url`/`filename`/`size_bytes`/`width`/`height`/`duration_sec`/
-- `is_main_photo`/`package_id`/`prompt_en`/`angle`/`used_in_packages` columns are NOT here: no
-- code in this repo reads or writes any of them, and adding a column nothing populates is exactly
-- the kind of schema/mapper drift that produced the real "Could not find the
-- 'campaign_data_source' column ... in the schema cache" failure earlier in this same session.
-- Any future column MUST be added to `AssetRow` + `AssetMapper` in the same change as the
-- migration.
--
-- Applied against the SAME Supabase project @aos/lead-store and apps/aaos-api already use (see
-- apps/aaos-api/.env's SUPABASE_URL). NOT auto-applied by this repo's tooling -- run it manually
-- before `GET /api/v1/assets` can return real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE assets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL DEFAULT 'dss-motor',
  -- AssetType: UNIT_PHOTO | BRAND | TESTIMONIAL | AI_VIDEO | AI_IMAGE | OVERLAY
  type               TEXT NOT NULL,
  -- AssetStatus: ACTIVE | ARCHIVED | PENDING. There is no REJECTED state in this domain, and no
  -- hard delete -- `ArchiveAsset` sets ARCHIVED and keeps both the row and the GCS object.
  status             TEXT NOT NULL DEFAULT 'ACTIVE',
  -- GCS object path (`StoragePath`). UNIQUE: one metadata row per stored object.
  storage_path       TEXT NOT NULL UNIQUE,
  public_url         TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  mime_type          TEXT NOT NULL,
  file_size          BIGINT NOT NULL,
  -- `AssetTag[]`. NOT NULL + '{}' default so `AssetMapper.toDomain`'s `for (... of row.tags)` can
  -- never receive NULL.
  tags               TEXT[] NOT NULL DEFAULT '{}',
  -- Unit context. `unit_id` is the `ScrapedUnit.identityKey` (mobixbydss.id detail-page slug),
  -- which is what `DownloadAndStorePhotos` writes -- deliberately TEXT, not a FK to
  -- `scraped_units`: photo rows must survive a unit disappearing from the listing.
  unit_id            TEXT,
  unit_model         TEXT,
  unit_year          INTEGER,
  -- Branch enum: CINERE | BINTARO | BANDUNG | JABODETABEK | BOOST | MULTI | UMUM
  branch             TEXT,
  -- AI-generation context, populated by `SaveAiCreative` for AI_VIDEO/AI_IMAGE assets.
  ai_prompt          TEXT,
  ai_model           TEXT,
  creative_brief_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes match the columns the real queries filter/sort on: `listAssets` (tenant + type + status
-- + branch + unit_id, ordered by created_at), `findByUnitId`, `findByBranch`, `findByType`.
CREATE INDEX idx_assets_tenant_created ON assets(tenant_id, created_at DESC);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_branch ON assets(branch);
CREATE INDEX idx_assets_unit ON assets(unit_id);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Tenant isolation, same shape as @aos/lead-store's own RLS policies. Note that every server-side
-- caller in this repo connects with the Supabase SERVICE key (see `AssetLibraryConfig
-- .supabaseServiceKey`), which bypasses RLS -- this policy is the defense-in-depth boundary for
-- anon/authenticated clients, and tenant scoping is additionally enforced in application code
-- (`AssetRepository.listAssets`/`getStats` filter on `tenant_id` explicitly).
CREATE POLICY "tenant_isolation" ON assets
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
