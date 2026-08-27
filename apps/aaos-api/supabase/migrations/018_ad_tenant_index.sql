-- AAOS-MULTI-TENANT-PHASE1C -- 018_ad_tenant_index.sql
-- Durable, tenant-keyed index from a real Meta `ad.metaId` to the tenant that owns it -- closes
-- the one gap Phase 1B (docs/PROMPT-AAOS-MULTITENANT-PHASE1B.md) deliberately deferred: the Meta
-- lead-ads webhook payload (`entry[].changes[].value.ad_id`) carries no tenant signal of its own,
-- and the only existing resolution path (`AdAccountRegistry.resolveAdByMetaId`) is an in-memory,
-- per-connector-instance cache that does not survive a process restart and only ever knows about
-- ONE tenant's own pulls at a time.
--
-- Populated additively by `AdTenantIndexRepository.upsertMany` (via the shared
-- `indexPulledAdAccount` helper) right after each of this app's 4 real
-- `pullCampaignData.execute`/`MetaAdsSyncService` call sites succeeds
-- (scheduler.service.ts/meta-ads.service.ts/intelligence.service.ts/abtesting.service.ts) --
-- never a correctness requirement for the pull itself, only a best-effort side effect.
--
-- COLUMN-FOR-COLUMN CONTRACT with `AdTenantIndexRow` in
-- src/modules/meta-ads/infrastructure/ad-tenant-index.repository.ts. Any future column MUST be
-- added there in the same change.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- the webhook handler's real per-tenant routing can resolve anything beyond the
-- `config.AAOS_TENANT_ID` fallback (see webhook.service.ts's own doc comment for the fallback's
-- exact, deliberate shape).

CREATE TABLE ad_tenant_index (
  -- Meta's own ad id, verbatim (TEXT: it is a numeric *string* in Meta's JSON, same precision
  -- hazard as `meta_interests.id` -- see that migration's own note).
  ad_meta_id     TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,

  -- The ad account this ad was pulled under -- carried alongside `tenant_id` for a future
  -- "list this tenant's indexed ad accounts" or cleanup need, not required by this phase's own
  -- code.
  ad_account_id  TEXT NOT NULL,

  -- Refreshed on every re-index (a later pull re-confirms/updates the mapping), so a stale entry
  -- is visibly stale rather than silently trusted.
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ad_tenant_index_tenant ON ad_tenant_index(tenant_id);
