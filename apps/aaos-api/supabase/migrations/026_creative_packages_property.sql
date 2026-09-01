-- AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE, EPIC K (K1/K2) -- 026_creative_packages_property.sql
-- Additive extension of `creative_packages` (003_creative_packages.sql) so a PROPERTY-vertical
-- Kai creative package can be persisted through the SAME table/lifecycle (DRAFT -> GENERATING ->
-- PENDING/FAILED -> APPROVED/REJECTED) an AUTOMOTIVE package already uses, rather than a second
-- parallel table -- the two verticals share the review-queue/status-machine shape even though
-- their real brief fields diverge (Finding: `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`).
--
-- `branch`/`unit`/`target_persona` are automotive-only real fields (`unit` = the scraped
-- `identityKey`, `target_persona` = `TargetPersona`) that a PROPERTY package genuinely has no
-- value for -- dropped to nullable rather than fabricating a value, matching this migration's own
-- "never fabricate" discipline. `vertical` discriminates which real shape a row is; `listing_id`
-- is the real, tenant-scoped `listings.id` a PROPERTY package was generated from (Finding 7 -- no
-- FK to `listings` here, same "no cross-schema FK" convention `003_creative_packages.sql` itself
-- already has none of).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `POST /api/v1/creative-packages/property` can persist real rows.

ALTER TABLE creative_packages
  ALTER COLUMN branch DROP NOT NULL,
  ALTER COLUMN unit DROP NOT NULL,
  ALTER COLUMN target_persona DROP NOT NULL;

ALTER TABLE creative_packages
  ADD COLUMN vertical TEXT NOT NULL DEFAULT 'AUTOMOTIVE',
  ADD COLUMN listing_id TEXT;

CREATE INDEX idx_creative_packages_listing ON creative_packages(listing_id)
  WHERE listing_id IS NOT NULL;
