-- AAOS-SCRAPER-ASSET-LIBRARY -- 001_scraped_units.sql
--
-- Durable per-unit metadata scraped from mobixbydss.id. Brand-new table: before this,
-- `MobixScraperService` kept scraped units in a process-local `lastSession` field only, so a unit's
-- price / km / color / transmission / availability never survived a restart and the dashboard had
-- no way to list real stock. The only thing previously persisted was each unit's individual PHOTO
-- rows in `assets` (written by `DownloadAndStorePhotos`), which carry unit_id/model/year/branch and
-- nothing else.
--
-- COLUMN-FOR-COLUMN CONTRACT: every column corresponds 1:1 to a field of
-- `ScrapedUnitMapper.ScrapedUnitRow` (src/infrastructure/mappers/ScrapedUnitMapper.ts) -- same
-- names, same nullability. Any future column MUST be added to `ScrapedUnitRow` + `ScrapedUnitMapper`
-- in the same change as this migration.
--
-- `identity_key` is `ScrapedUnit.identityKey` (the detail-page URL slug) -- the same value
-- `DetectInventoryChanges` diffs on and `assets.unit_id` already stores, so a unit's metadata here
-- and its photos in `assets` join on it with no new identifier invented.
--
-- Applied against the SAME Supabase project @aos/lead-store / @aos/asset-library / apps/aaos-api
-- already use. NOT auto-applied by this repo's tooling -- run it manually before
-- `GET /api/v1/scraper/stock` can return real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE scraped_units (
  identity_key   TEXT NOT NULL,
  tenant_id      TEXT NOT NULL DEFAULT 'dss-motor',
  url            TEXT NOT NULL,
  brand          TEXT NOT NULL,
  model          TEXT NOT NULL,
  year           INTEGER NOT NULL,
  -- 'AT' | 'MT' (ScrapedUnit.Transmission)
  transmission   TEXT NOT NULL,
  color          TEXT NOT NULL,
  kilometer      INTEGER NOT NULL,
  price_idr      BIGINT NOT NULL,
  -- Branch enum: CINERE | BINTARO | BANDUNG | JABODETABEK | BOOST | MULTI | UMUM
  branch         TEXT NOT NULL,
  -- SOURCE photo URLs found on the mobixbydss.id listing. NOT the GCS-stored copies -- those are
  -- rows in `assets` (type='UNIT_PHOTO', unit_id = this identity_key). NOT NULL + '{}' default so
  -- `ScrapedUnitMapper.toDomain` can never receive NULL.
  photos         TEXT[] NOT NULL DEFAULT '{}',
  available      BOOLEAN NOT NULL DEFAULT true,
  scraped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The conflict target `ScrapedUnitRepository.upsertMany` upserts on, so re-running a scrape
  -- refreshes each unit in place instead of accumulating duplicates.
  PRIMARY KEY (tenant_id, identity_key)
);

CREATE INDEX idx_scraped_units_tenant_scraped ON scraped_units(tenant_id, scraped_at DESC);
CREATE INDEX idx_scraped_units_branch ON scraped_units(branch);
CREATE INDEX idx_scraped_units_available ON scraped_units(available);
CREATE INDEX idx_scraped_units_model ON scraped_units(model);

ALTER TABLE scraped_units ENABLE ROW LEVEL SECURITY;

-- Same defense-in-depth note as `assets`: every server-side caller connects with the Supabase
-- SERVICE key (which bypasses RLS), and `ScrapedUnitRepository` filters on `tenant_id` explicitly
-- in application code.
CREATE POLICY "tenant_isolation" ON scraped_units
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
