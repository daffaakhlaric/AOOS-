-- EYVRA -- SAMANTHA V2, Phase 6 -- 056_samantha_campaign_assessments.sql
--
-- REAL GAP THIS CLOSES: `modules/campaign-health` (Phase 3 `CampaignHealthService.assess` +
-- Phase 4 `decideNextAction`) computes a real `CampaignHealth`/`CampaignDiagnosis`/
-- `SamanthaDecision` triple entirely in memory, on demand, every time `GET
-- /api/v1/campaign-health/:campaignId` is called -- and throws it away the moment the HTTP
-- response is sent. There is no way to see how a campaign's health/diagnosis/decision changed
-- over time, and no way for a future scheduled job to compare "this assessment" against "the last
-- one" before deciding whether anything meaningful changed (the original spec's own PROMPT 103
-- "AI Cost Control" principle -- "do not run expensive reasoning when nothing meaningful
-- changed"). This migration adds the durable home for that: one row per REAL, PERSISTED
-- assessment, written only when a caller explicitly opts into persistence (`POST
-- /api/v1/campaign-health/:campaignId/assess`, distinct from the existing on-demand, non-persisting
-- `GET /:campaignId`).
--
-- This phase is PURE PERSISTENCE + READ-BACK. It does not compute anything new (the exact same
-- `assess()` orchestration Phase 3/4 already shipped is reused, unchanged), does not add any
-- dedup/skip-if-unchanged logic (that is explicitly a later phase, once there is real history to
-- compare against), and wires no scheduled/cron caller -- `POST .../assess` is only ever invoked
-- on demand, by a real HTTP caller, exactly like every other endpoint in this module.
--
-- WHY `meta_campaign_id` is NOT a foreign key to `meta_campaigns.id`: a campaign this module
-- assesses may not have synced into `meta_campaigns` yet at assessment time (`MetricSnapshotService`
-- already tolerates that -- see `metric-snapshot.repository.ts`'s own "returns [] honestly when
-- nothing has been synced yet" doc). Requiring the FK would make `POST .../assess` fail for exactly
-- the campaigns most in need of a health check (freshly created, not yet synced). Same
-- "no FK, app validates" reasoning `020_tenant_mode.sql`'s family of tables already establishes for
-- free-TEXT `tenant_id`/`meta_campaign_id` columns throughout this schema.
--
-- WHY there is no `updated_at` column: rows here are NEVER updated after insert -- each real
-- assessment is its own immutable row, same "durable, append-only, never-mutated-after-write"
-- shape `021_agent_activities.sql`'s `agent_activities` and `050_meta_sync.sql`'s
-- `meta_insights_daily` already establish elsewhere in this schema. A later re-assessment of the
-- same campaign simply inserts a new row -- it never rewrites an earlier one, which is exactly
-- what makes this table usable as a real history/audit trail.
--
-- `health`/`diagnosis`/`decision` are stored as JSONB verbatim -- the real, already-serializable
-- `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` domain objects
-- (`modules/campaign-health/domain/*.ts`), never re-shaped into relational columns. Those types are
-- still evolving across phases (Phase 3/4 both added fields without a migration), so JSONB avoids a
-- migration every time a domain field is added -- same reasoning `hot_lead_definitions.rules`
-- (`054_growth_objectives.sql`) already gives for keeping an evolving nested shape in JSONB rather
-- than flattened columns.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `CampaignAssessmentRepository` can persist/read real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE samantha_campaign_assessments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        TEXT NOT NULL,

  -- The real Meta campaign id -- same free-TEXT, no-FK convention every other
  -- `meta_campaign_id`-keyed table/endpoint in this codebase already uses (see header doc above).
  meta_campaign_id TEXT NOT NULL,

  -- The real, already-serializable Phase 3/4 domain objects, verbatim -- see header doc for why
  -- JSONB rather than flattened columns.
  health           JSONB NOT NULL,
  diagnosis        JSONB NOT NULL,
  decision         JSONB NOT NULL,

  -- DB-defaulted (never a client-side timestamp) so this honestly reflects when the INSERT itself
  -- landed, not when the caller started computing it.
  assessed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The real "history" query shape this phase's `listHistory` needs: latest-first, scoped to one
-- tenant + campaign.
CREATE INDEX idx_samantha_campaign_assessments_tenant_campaign_assessed
  ON samantha_campaign_assessments (tenant_id, meta_campaign_id, assessed_at DESC);
