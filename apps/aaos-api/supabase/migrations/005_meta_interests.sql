-- AAOS-SIMULASI-TARGETING -- 005_meta_interests.sql
-- Durable storage for REAL Meta ad-interest targeting options, fetched from the live Graph API
-- endpoint `GET /search?type=adinterest&q=<term>` (confirmed live 2026-08-18) by
-- `@aos/meta-ads-connector`'s `SearchAdInterests` use case and upserted by
-- `POST /api/v1/meta-interests/sync`.
--
-- Same shape convention as 001_simulations.sql / 002_scrape_jobs.sql / 003_creative_packages.sql /
-- 004_creative_logs.sql -- snake_case columns, `tenant_id TEXT NOT NULL DEFAULT 'dss-motor'`,
-- `TIMESTAMPTZ` timestamps, JSONB for the low-volume list fields -- applied against the SAME
-- Supabase project every other AAOS table lives in (see app.module.ts's `SUPABASE_CLIENT` wiring).
--
-- COLUMN-FOR-COLUMN CONTRACT with `MetaInterestRow` in
-- src/modules/meta-interests/infrastructure/meta-interest.repository.ts. Any future column MUST be
-- added there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/meta-interests/sync` can persist real rows, and before the Simulasi wizard's
-- audience preview can show any real interest (with no rows, Samantha is honestly given an empty
-- candidate set and the preview reports "belum ada kandidat interest" -- never a fabricated one).
--
-- WHY NO `id UUID DEFAULT gen_random_uuid()` HERE (the one deliberate departure from 001-004):
-- `id` is META's OWN interest identifier (a numeric string, e.g. '6003304550260'). It is the exact
-- value Meta's targeting spec expects, it is globally unique and stable on Meta's side, and using
-- it directly as the primary key is what makes the sync endpoint's re-run idempotent (the same
-- interest surfaced by two different search terms is ONE row, refreshed, not two). Generating a
-- surrogate UUID would add a second identity for the same real object and lose that.

CREATE TABLE meta_interests (
  -- Meta's own ad-interest id, verbatim (TEXT: it is a numeric *string* in Meta's JSON, and long
  -- enough that treating it as a number would be a precision hazard).
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL DEFAULT 'dss-motor',

  -- Meta's own display name, e.g. 'Used car (vehicle)'. Shown verbatim in the Simulasi preview.
  name                   TEXT NOT NULL,

  -- Meta's own reported audience-size bounds. NEVER estimated, interpolated, or averaged by AAOS --
  -- BIGINT because the real values run into the billions (e.g. 1211170550 for 'Family (social
  -- concept)'), which overflows a 32-bit INTEGER.
  audience_size_lower    BIGINT NOT NULL,
  audience_size_upper    BIGINT NOT NULL,

  -- Meta's taxonomy breadcrumb, e.g. ["Interests","Additional interests","Used car (vehicle)"].
  -- JSONB (a string array) rather than TEXT[] to match this repo's existing convention for list
  -- columns (persona_ids, source_photo_urls, image_urls, copy_variants are all JSONB).
  path                   JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Meta's coarse grouping, e.g. 'Business and industry'. NULLable: Meta does not guarantee it.
  topic                  TEXT,

  -- AAOS provenance, not a Meta field: the curated search term whose live call surfaced this row.
  -- On a re-sync where two terms surface the same interest, this holds the most recent one.
  search_term            TEXT NOT NULL,

  -- When the live Meta call that produced this row happened. Refreshed on every re-sync, so a stale
  -- catalogue is visibly stale rather than silently trusted.
  fetched_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meta_interests_tenant ON meta_interests(tenant_id);
CREATE INDEX idx_meta_interests_search_term ON meta_interests(search_term);
CREATE INDEX idx_meta_interests_fetched ON meta_interests(fetched_at DESC);
