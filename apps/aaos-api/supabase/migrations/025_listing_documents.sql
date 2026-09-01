-- AAOS Property Tenant Isolation (Phase 2 of 2) -- 025_listing_documents.sql
-- Backs `POST/DELETE /api/v1/listings/:id/documents(/:documentId)` (`modules/listings`'s new
-- listing supporting-document attach/remove), per
-- docs/PROMPT-AAOS-PROPERTY-TENANT-ISOLATION-DOCS.md's "Phase 2 -- Listing supporting documents
-- (PDF/Excel/promo)" section.
--
-- COLUMN-FOR-COLUMN CONTRACT with `ListingDocumentRow` in
-- src/modules/listings/infrastructure/listing.repository.ts. Any future field MUST be added there
-- in the same change.
--
-- SHAPE CHOICE: a new JSONB array column, `documents`, on the existing `listings` table --
-- deliberately NOT a new table. This mirrors `008_listings.sql`'s own `photos` JSONB-array
-- precedent exactly rather than inventing a second storage shape for a structurally identical
-- problem ("N small file-attachment records belonging to one listing, read/written wholesale with
-- the listing, no independent query/RLS need of their own"). A document, unlike a photo, is not a
-- gallery item (no `order`/`isMain`) -- it carries `filename`/`mimeType`/`sizeBytes`/optional
-- `label`/`uploadedAt` instead, POPULATED by `POST /api/v1/listings/:id/documents`, which reuses
-- the exact same `@aos/asset-library` `IAssetStorage`/GCS adapter `addPhoto` already uses for byte
-- upload (see that endpoint's docstring in listings.service.ts) -- never a second upload pipeline.
-- A row-level table (with its own RLS) was considered and rejected: no per-document query
-- (filter/sort/paginate independently of its parent listing) or per-document RLS policy is a real
-- requirement in this phase -- exactly the same reasoning that already justifies `photos` as JSONB
-- rather than its own table.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST/DELETE /api/v1/listings/:id/documents*` can persist real rows.

ALTER TABLE listings
  ADD COLUMN documents JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN listings.documents IS
  'JSONB array of listing supporting documents (PDF/Excel/promo), Phase 2. Each entry: '
  '{ id, filename, url, mimeType, sizeBytes, label?, uploadedAt, storagePath }. '
  '`storagePath` is the real GCS object path (distinct from the public `url`), kept internal-only '
  '(never sent in ListingResponseDto/DocumentResponseDto) so DELETE /:id/documents/:documentId can '
  'issue a real, best-effort GCS object deletion alongside removing this JSONB entry.';
