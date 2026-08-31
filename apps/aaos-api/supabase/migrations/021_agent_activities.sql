-- AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG (Phase B) -- 021_agent_activities.sql
-- Backs the new real agent activity log (`modules/activity-log`'s `ActivityLogger`/
-- `ActivityLogRepository`/`ActivityLogController`) and the dashboard's new realtime Activity Log
-- page (`apps/aaos-dashboard/src/components/activity/ActivityLogClient.tsx`).
--
-- See docs/PROMPT-AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG.md, Phase B point 1 -- "this part of the
-- spec is sound as-is, no correction needed". `tenant_id`/`mode` follow the SAME conventions
-- `020_tenant_mode.sql`/`016_intelligence.sql` already establish for this app (free `TEXT`,
-- `DEFAULT 'dss-motor'`, no FK to `tenants` -- every other aaos-api-owned table in this migration
-- folder makes the same choice, see `016_intelligence.sql`'s header doc).
--
-- ONE row per gated agent action (`ActivityLogger.start` inserts it RUNNING; `.complete`/`.fail`
-- update the SAME row in place -- never a second row for the same action), covering Phase A's two
-- real `ModeGuardService`-gated call sites today (`MetaAdsService.executeVerdict`,
-- `CampaignsService.createCampaign`) and any future gated/agentic action.
--
-- REALTIME CORRECTION (coordinator note, before this agent started): the pasted spec's own
-- `ActivityLogger.complete()` mockup used a manual `supabase.channel(...).send({ type:
-- "broadcast", ... })` call. This codebase's REAL, established Realtime precedent
-- (`apps/aaos-dashboard/src/lib/realtime.ts`'s `subscribeToLeadChat`) is a plain `postgres_changes`
-- subscription that fires off a real DB row INSERT -- NOT a manually-sent broadcast payload. This
-- table/RLS policy is written for THAT real pattern: `ActivityLogger.start` does a plain
-- `.insert(...)`, nothing more: the INSERT itself is what the dashboard's `postgres_changes`
-- subscription observes.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `ActivityLogger`/the dashboard's Activity Log page can persist/read/subscribe to real rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE agent_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL DEFAULT 'dss-motor',

  -- Groups every activity row that belongs to the same real request/agentic loop (this app's
  -- existing `correlationId` -- see `MetaAdsService.executeVerdict`/`CampaignsService.createCampaign`,
  -- which already thread one through every real call). NULL-able: not every future caller of
  -- `ActivityLogger.start` necessarily has one yet.
  loop_id        TEXT,

  -- SAMANTHA | CLARA | KAI | KAREN, per `CLAUDE.md`'s real agent roster -- free TEXT (not a CHECK
  -- enum) so a future 5th agent never needs a migration to be logged.
  agent          TEXT NOT NULL,

  -- e.g. 'EXECUTE_VERDICT' | 'CREATE_CAMPAIGN' -- the real gated action this row describes. Free
  -- TEXT, same "Zod validates at the API boundary, DB just stores it" convention `tenants.mode`
  -- documents on itself.
  action_type    TEXT NOT NULL,

  -- 'DEV' | 'LIVE' -- the tenant's real mode AT THE TIME this action ran, per
  -- `ModeGuardService.resolveMode` (Phase A). Stamped once at `start()`, never re-resolved later,
  -- so a row always honestly reflects what actually happened even if the tenant's mode is flipped
  -- again afterward.
  mode           TEXT NOT NULL CHECK (mode IN ('DEV', 'LIVE')),

  -- RUNNING (set by `start()`) -> SUCCESS | SIMULATED | ERROR (set by `complete()`/`fail()`).
  -- SIMULATED (not SUCCESS) is the real outcome for every DEV-mode action -- distinguishing "ran
  -- for real" from "was honestly simulated" is the entire point of this table existing alongside
  -- Phase A's mode gate.
  status         TEXT NOT NULL DEFAULT 'RUNNING'
                   CHECK (status IN ('RUNNING', 'SUCCESS', 'SIMULATED', 'ERROR')),

  input          JSONB,
  output         JSONB,
  dev_preview    JSONB,
  reasoning      TEXT,
  tool_calls     JSONB NOT NULL DEFAULT '[]'::jsonb,

  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  duration_ms    INTEGER,

  error_message  TEXT,
  error_stack    TEXT,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5 indexes, per the design doc's Phase B point 1.
CREATE INDEX idx_agent_activities_tenant           ON agent_activities(tenant_id);
CREATE INDEX idx_agent_activities_tenant_agent      ON agent_activities(tenant_id, agent);
CREATE INDEX idx_agent_activities_tenant_status     ON agent_activities(tenant_id, status);
CREATE INDEX idx_agent_activities_tenant_created    ON agent_activities(tenant_id, created_at DESC);
CREATE INDEX idx_agent_activities_loop              ON agent_activities(loop_id);

-- RLS -- mirrors `packages/lead-store/supabase/migrations/004_message_sender.sql`'s
-- `manager_view_all_messages`/`manager_view_all_scoring_events` policy SHAPE (same
-- `auth.jwt() -> 'user_metadata' ->> 'role'` convention, matching `apps/aaos-dashboard`'s
-- `lib/auth.ts` `UserRole`) -- this is what lets a manager's browser client (anon key,
-- `apps/aaos-dashboard/src/lib/supabase.ts`) both list rows AND receive this table's
-- `postgres_changes` INSERT events (Realtime runs under the same RLS as a normal SELECT).
--
-- ADAPTED, not copied verbatim: `messages`/`scoring_events` have no `tenant_id` column at all (a
-- single-tenant-per-deployment schema historically), so `004`'s policy could only scope by role.
-- `agent_activities` is multi-tenant from day one and DOES carry a real `tenant_id`, and
-- `lib/auth.ts`'s `SessionInfo.tenantId` (from `user_metadata.tenantId`) is already the real,
-- established per-session tenant id this whole session's Multi-Tenant Phase 1B/1C work reads --
-- so this policy also scopes by the caller's own JWT `tenantId`, which `004`'s policy had no
-- equivalent column to do. Never widened to "every manager sees every tenant's activities".
ALTER TABLE agent_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_activities" ON agent_activities
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
