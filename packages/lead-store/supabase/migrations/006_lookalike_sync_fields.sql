-- AAOS-ABTESTING-LOOKALIKE Part 2 -- 006_lookalike_sync_fields.sql
-- Additive columns on `leads` for Samantha's Lookalike Audience feature
-- (docs/PROMPT-AAOS-ABTESTING-LOOKALIKE.md). Lives HERE, in @aos/lead-store's own migration
-- folder, not apps/aaos-api/supabase/migrations -- per the coordinator note's section 7: `leads`
-- itself (and every column on it) is owned by @aos/lead-store, exactly like 001-005 before it.
-- The brand-new `meta_audiences` table this feature needs is NOT here -- it's conceptually owned
-- by `apps/aaos-api`'s new `LookalikeService`/`lookalike` module (the only thing that ever
-- reads/writes it), so it lives in apps/aaos-api/supabase/migrations/013_lookalike.sql instead --
-- same split `005_recycling_fields.sql`/`010_recycling.sql` already established.
--
-- COLUMN-FOR-COLUMN CONTRACT with `LeadRow` in src/infrastructure/mappers/LeadMapper.ts. Any
-- future column MUST be added there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LookalikeService.syncHotLeadsToMeta`'s sync-tracking code path can persist real values.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  synced_to_meta_audience BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_sync
  ON leads(tenant_id, status, synced_to_meta_audience);
