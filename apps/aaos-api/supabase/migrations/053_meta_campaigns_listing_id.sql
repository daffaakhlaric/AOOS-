-- Campaign->Listing Mapping (follow-up to the Samantha Meta Ads Settings + Creative Copy
-- Recommendation feature) -- 053_meta_campaigns_listing_id.sql
--
-- REAL GAP THIS CLOSES: `AndromedaHealthCard.tsx`'s "Brief Kai sekarang" button and
-- `MetaSettingsPanel.tsx`'s per-copy "Brief Kai" button both need a real `listings.id` for the
-- currently-selected campaign to call the real `POST /api/v1/creative-packages/property` endpoint
-- (it requires `listingId`) -- until now, no persisted campaign->listing mapping existed anywhere
-- in this codebase's real data model, so both buttons always rendered honestly disabled.
--
-- REAL FIX: `meta_campaigns` (050_meta_sync.sql) is the one durable, already-existing table with
-- exactly one row per real, synced Meta campaign (`UNIQUE (tenant_id, meta_campaign_id)`) --
-- exactly the right place for this link, rather than a new parallel table for the same "one row
-- per real campaign" concept. `listing_id` is nullable (most campaigns -- AUTOMOTIVE ones, or any
-- PROPERTY campaign created before this migration -- genuinely have no real listing link) and
-- ON DELETE SET NULL (a deleted listing must never leave a dangling FK on a real campaign row that
-- otherwise still has real synced ad-performance history).
--
-- WRITE PATH: `CampaignsService.createPropertyCampaign`'s real LIVE branch (never DEV/simulated --
-- there is no real Meta campaign id to link to in a simulation) calls
-- `MetaSyncRepository.linkCampaignListing` right after its existing `metaSync.syncCampaign` hook,
-- so the real `meta_campaigns` row already exists by the time the link UPDATE runs.
--
-- READ PATH: `GET /api/v1/campaigns/:campaignId/listing-id` (`campaignId` = the real, stable
-- `meta_campaign_id`, same convention `.../history` and `.../andromeda-health` already use).
--
-- SYNC SAFETY: `MetaSyncRepository.upsertCampaigns` (the periodic 15-minute/daily sync's own real
-- upsert) never includes `listing_id` in its upsert payload -- Postgres's `ON CONFLICT DO UPDATE`
-- only touches columns explicitly listed, so the periodic sync can never silently null out a real
-- link this migration's write path set.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `CampaignsService.createPropertyCampaign`'s new link write / the new listing-id read endpoint
-- can work against real data.

ALTER TABLE meta_campaigns
  ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_listing_id ON meta_campaigns(listing_id)
  WHERE listing_id IS NOT NULL;
