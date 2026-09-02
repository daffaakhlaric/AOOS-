-- AAOS-OPERATING-MODE-APPROVAL-GATE -- 031_operating_mode.sql
-- Backs the new tenant-level Settings toggle (`FULL_CONTROL` | `APPROVAL`), distinct from the
-- existing DEV/LIVE `mode` axis (`020_tenant_mode.sql`), and the new `pending_agent_actions` queue
-- a gated automated action writes to instead of firing immediately.
--
-- See docs/PROMPT-AAOS-OPERATING-MODE-APPROVAL-GATE.md for the full reasoning this migration
-- follows column-for-column. Real user answers to that doc's "OPEN QUESTIONS FOR THE USER":
--   1. Default is 'FULL_CONTROL' -- a strictly additive, zero-behavior-change rollout. Every
--      existing tenant's `SchedulerService` PROPERTY campaign-creation trigger keeps firing
--      exactly as it does today (unconditionally, per AAOS EPIC S Phase S5) the moment this
--      migration runs -- no tenant is silently switched into a gated/paused state.
--   2. Scope is limited to the ONE real automated action -- `SchedulerService`'s PROPERTY
--      campaign-creation trigger -- not the other manually-invoked ModeGuard-gated actions
--      (`CampaignsService.createCampaign`, `MetaAdsService.executeVerdict`). `pending_agent_actions`
--      is deliberately generalized (not `pending_campaign_actions`) so a future gated action can
--      reuse this same queue without a redesign.
--
-- COLUMN-FOR-COLUMN CONTRACT with `TenantRow` in
-- src/modules/superadmin/infrastructure/tenant.repository.ts. Any future column MUST be added
-- there in the same change (same discipline `020_tenant_mode.sql`'s header doc establishes for
-- its own `mode` columns).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `PATCH /api/v1/settings/operating-mode` or `SchedulerService.runPropertyCampaignTriggerCheck`
-- can read/write a real per-tenant operating mode.

ALTER TABLE tenants
  ADD COLUMN operating_mode TEXT NOT NULL DEFAULT 'FULL_CONTROL'
    CHECK (operating_mode IN ('FULL_CONTROL', 'APPROVAL')),
  ADD COLUMN operating_mode_changed_at TIMESTAMPTZ,
  ADD COLUMN operating_mode_changed_by TEXT;

CREATE INDEX idx_tenants_operating_mode ON tenants(operating_mode);

-- `pending_agent_actions` -- a real, generalized pending-action queue (design doc's real Finding
-- #4: `agent_activities`/`ActivityLogger` is a pure write-then-display audit trail, nothing in this
-- codebase ever reads a row back to decide whether to proceed with a further action -- a genuine
-- pause-and-later-execute needs a real, separate table). Same real PENDING/APPROVED/REJECTED
-- decision shape `learning_proposals` (`024_learning_proposals.sql`) and `StoredSimulation.decision`
-- already establish -- reused here rather than a second decision mechanic being invented.
--
-- `payload` is real and sufficient to actually invoke the gated action later (e.g.
-- `{listingId, dailyBudgetIDR}` for `CampaignsService.createPropertyCampaign`'s real body) --
-- `PendingActionsService.approve` calls that SAME real method with this stored payload, never a
-- second, parallel campaign-creation code path.
--
-- `tenant_id`/no-FK-to-tenants follows the SAME convention `020_tenant_mode.sql`/
-- `021_agent_activities.sql`/`024_learning_proposals.sql` already establish for this app (free
-- TEXT, no FK).
--
-- Read-only from every real aaos-api consumer via the anon-key browser client -- both the real
-- writer (`SchedulerService`, enqueuing) and the real Approve/Reject decision writer
-- (`PendingActionsService`) go through aaos-api's own service-role Supabase client (the SAME
-- `SUPABASE_CLIENT` every other aaos-api-owned table's writer uses), never the anon-key browser
-- client -- so no INSERT/UPDATE RLS policy is added here speculatively (same reasoning
-- `024_learning_proposals.sql`'s header doc gives for its own SELECT-only policy).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE pending_agent_actions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,

  -- SAMANTHA today -- free TEXT, same reasoning `021_agent_activities.sql`'s/
  -- `024_learning_proposals.sql`'s own `agent` columns document on themselves: a future gated
  -- action from another agent should never need a migration just to enqueue here.
  agent          TEXT NOT NULL,

  -- e.g. 'CREATE_PROPERTY_CAMPAIGN' today -- free TEXT (not a CHECK enum), same "a future gated
  -- action type should never need a migration" reasoning.
  action_type    TEXT NOT NULL,

  -- Everything real and needed to actually invoke the gated action later -- e.g.
  -- `{listingId, dailyBudgetIDR}` for `CREATE_PROPERTY_CAMPAIGN`, matching
  -- `CreatePropertyCampaignBodyDto` exactly so `PendingActionsService.approve` can pass it straight
  -- through to the real `CampaignsService.createPropertyCampaign` unchanged.
  payload        JSONB NOT NULL,

  status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  decided_by     TEXT,
  decision_notes TEXT,
  decided_at     TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_agent_actions_tenant_status  ON pending_agent_actions(tenant_id, status);
CREATE INDEX idx_pending_agent_actions_tenant_created  ON pending_agent_actions(tenant_id, created_at DESC);

-- RLS -- mirrors `024_learning_proposals.sql`'s `manager_view_own_tenant_learning_proposals` policy
-- SHAPE exactly (same `auth.jwt() -> 'user_metadata'` convention). SELECT only: a manager/owner can
-- see their own tenant's pending-action rows (the dashboard's real pending-actions UI surface) --
-- no INSERT/UPDATE policy, per this file's header doc.
ALTER TABLE pending_agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_pending_agent_actions" ON pending_agent_actions
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
