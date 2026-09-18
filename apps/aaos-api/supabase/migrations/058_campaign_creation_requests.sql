-- EYVRA — SAMANTHA V2 Phase 26 (PROMPT 36 — Safe Campaign Creation, PROMPT 37 — Campaign Creation
-- Idempotency).
--
-- REAL GAP THIS CLOSES: Phase 25 (`campaign-creation` module) built read-only Listing Readiness /
-- Campaign Blueprint / Campaign Preflight — zero persistence, zero Meta mutation. This phase adds
-- the FIRST real Meta-mutating path driven by a Growth Objective (`POST
-- .../campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/create`), and
-- needs a durable place to (a) record what was actually created on Meta and (b) prevent a retried
-- request from creating a duplicate real campaign.
--
-- WHY A NEW TABLE, NOT `meta_campaigns` (050_meta_sync.sql): `meta_campaigns` is a periodic SYNC
-- MIRROR — one row per campaign that already exists on Meta, populated by pulling FROM Meta
-- (`MetaSyncService.syncCampaign`/the 15-minute cron), best-effort and non-blocking by design (see
-- `CampaignsService`'s own `void this.metaSync.syncCampaign(...)` call sites). It has no
-- `growth_objective_id` column, no `creation_request_id`/`blueprint_id`/idempotency concept, and its
-- write path is deliberately fire-and-forget — exactly the wrong properties for a row that MUST
-- exist synchronously, before the real Meta call, so a concurrent/retried request can see it and
-- refuse to create a second campaign. This table is that dedicated idempotency ledger; nothing
-- about it duplicates `meta_campaigns`' own sync-mirror concern.
--
-- IDEMPOTENCY KEY: `UNIQUE (tenant_id, growth_objective_id, listing_id)` — one real campaign per
-- Growth-Objective+Listing pair, ever, via this pipeline. `CampaignCreationRepository.claim`/
-- `.reclaim` use this constraint plus an explicit `status` compare-and-swap (`UPDATE ... WHERE
-- status = <expected>`) so two concurrent requests can never both proceed to a real Meta call —
-- see that repository's own doc for the exact race-safety argument.
--
-- STATUS LIFECYCLE: PENDING (claimed, real Meta call in flight) -> CREATED (campaign + ad set both
-- created, real ids stored) | PARTIAL_FAILURE (campaign created, ad set creation failed — a real,
-- inert PAUSED campaign exists on Meta; `meta_campaign_id` is set, `meta_ad_set_id` stays null) |
-- FAILED (nothing was created on Meta — safe to retry) | SIMULATED (DEV-mode tenant — `ModeGuard`
-- never touched Meta at all — also safe to retry once the tenant is LIVE). Only CREATED/
-- PARTIAL_FAILURE are ever treated as "a real Meta object already exists, do not retry
-- automatically" — see `CampaignCreationService.createCampaign`'s own doc.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `CampaignCreationRepository` can persist a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS campaign_creation_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  growth_objective_id UUID NOT NULL REFERENCES growth_objectives(id) ON DELETE CASCADE,
  listing_id          UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  -- Regenerated on every claim/reclaim attempt — identifies THIS particular attempt, distinct from
  -- the stable idempotency key below (tenant_id, growth_objective_id, listing_id).
  creation_request_id UUID NOT NULL,
  -- The blueprint has no natural id (Phase 25's `buildCampaignBlueprint` is a pure, stateless
  -- function — see that file's header doc) — generated once per attempt by
  -- `CampaignCreationService` at execution time, persisted here so a stored result can be traced
  -- back to "which blueprint computation produced this real campaign".
  blueprint_id        UUID NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('PENDING', 'CREATED', 'PARTIAL_FAILURE', 'FAILED', 'SIMULATED')),
  meta_campaign_id    TEXT,
  meta_ad_set_id      TEXT,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, growth_objective_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_creation_requests_tenant
  ON campaign_creation_requests(tenant_id);
