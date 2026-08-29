-- AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY (Phase 2) -- 008_listings.sql
-- Backs the new `modules/listings` (Listing Manager: /listings + /listings/:id in
-- apps/aaos-dashboard, PROPERTY vertical's real replacement for Scraper Mobix). Same shape
-- convention as 001-007 -- snake_case columns, `gen_random_uuid()` primary keys, `TIMESTAMPTZ`
-- timestamps -- applied against the SAME Supabase project every other AAOS table lives in.
--
-- COLUMN-FOR-COLUMN CONTRACT with `ListingRow` in
-- src/modules/listings/infrastructure/listing.repository.ts. Any future column MUST be added
-- there in the same change.
--
-- SCOPE: Phase 2 only (coordinator note section 7). Follows spec Part 8's `listings` SQL closely,
-- with `photos` as a real JSONB array of `{ id, url, label, order, isMain }` objects (populated by
-- `POST /api/v1/listings/:id/photos`, which reuses `@aos/asset-library`'s real `IAssetStorage`/GCS
-- adapter for the byte upload -- see that endpoint's docstring -- never a second upload pipeline).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `GET/POST /api/v1/listings*` can persist real rows.

CREATE TABLE listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL DEFAULT 'dss-motor',

  title             TEXT NOT NULL,
  -- RUMAH | APARTEMEN | RUKO | TANAH | VILLA. Free TEXT (not a CHECK/ENUM), validated by Zod at
  -- the API boundary (`CreateListingBodySchema`), matching `tenants.vertical`'s precedent.
  property_type     TEXT NOT NULL,
  -- AKTIF | DISEWAKAN | TERJUAL | DRAFT.
  listing_status    TEXT NOT NULL DEFAULT 'DRAFT',
  price             BIGINT NOT NULL,
  branch_id         TEXT,
  wa_number         TEXT,

  -- SPESIFIKASI
  land_area         INTEGER,
  build_area        INTEGER,
  bedrooms          INTEGER,
  bathrooms         INTEGER,
  garage            INTEGER,
  floors            INTEGER,
  certificate       TEXT,
  condition         TEXT,
  electricity       INTEGER,
  facing            TEXT,

  -- LOKASI
  address           TEXT,
  city              TEXT,
  province          TEXT,
  postal_code       TEXT,

  -- DESKRIPSI & KEUNGGULAN
  description       TEXT,
  highlights        TEXT[] NOT NULL DEFAULT '{}',

  -- FOTO: JSONB array of `{ id, url, label, order, isMain }`. `main_photo_url` is denormalized
  -- from the entry with `isMain: true` so the Listing Manager grid card can render a thumbnail
  -- with a single-column `SELECT`, not a JSONB unwrap per row.
  photos            JSONB NOT NULL DEFAULT '[]'::jsonb,
  main_photo_url    TEXT,

  -- Set by `POST /api/v1/listings/:id/publish-knowledge` (Clara's `PropertyKnowledge` generation
  -- -- spec Part 6/Listing Detail page's "Jadikan Knowledge Samantha" action).
  in_knowledge_base BOOLEAN NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listings_tenant ON listings(tenant_id);
CREATE INDEX idx_listings_status ON listings(listing_status);
