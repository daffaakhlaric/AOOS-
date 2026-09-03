-- AAOS-GEO-TARGETING-AND-REGION-PICKER Part B -- 033_listings_kecamatan.sql
-- Additive, nullable column -- existing listings without a kecamatan value stay valid, no
-- backfill required. Backs the new real cascading province -> kabupaten/kota -> kecamatan
-- picker in the Listing Manager's Add/Edit form (`ListingModal.tsx`), sourced from the real
-- public wilayah catalog (`modules/region`). Same snake_case-column / additive-only convention
-- every migration since 008_listings.sql already follows for this table -- `city`/`province`
-- stay exactly as they are (still free TEXT, now populated by the cascading picker's chosen
-- `nama` display string rather than hand-typed text, but the column contract is unchanged).
--
-- COLUMN-FOR-COLUMN CONTRACT with `ListingRow` in
-- src/modules/listings/infrastructure/listing.repository.ts.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project.

ALTER TABLE listings ADD COLUMN kecamatan TEXT;
