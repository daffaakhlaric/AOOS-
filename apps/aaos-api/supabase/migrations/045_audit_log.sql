-- AAOS LOOP UPGRADE, Sprint 6 Prompt 17 -- Audit Log -- 045_audit_log.sql
-- New table, `modules/audit-log` (new, small module — `AuditLogRepository`/`AuditLogService`),
-- distinct from `agent_activities` (021_agent_activities.sql): that table answers "what did an
-- agent DO"; this one answers "WHO decided, and was it approved" — the same real distinction this
-- sprint's own spec draws. Real, additive migration — no existing table renamed or repurposed.
--
-- Real next migration number verified directly against this folder's actual latest
-- (044_creative_packages_fatigue.sql) before choosing 045 — no other 045 exists.
--
-- REAL WRITERS THIS PHASE WIRES (investigated, not invented — see `AuditLogService`'s own doc for
-- the full mapping):
--   - `PendingActionsService.approve`/`.reject` — the real, already-existing human-approval gate for
--     an AI-recommended action (`operating_mode = 'APPROVAL'`). `approve` → VERDICT_APPLIED,
--     `reject` → VERDICT_REJECTED. `before_state` = the pending row's real `payload`; `after_state`
--     = the real `createPropertyCampaign` result (approve) or `null` (reject, which touches nothing
--     else — same "Reject changes nothing else" framing `PendingActionsService.reject`'s own doc
--     already gives).
--   - `MetaAdsService.executeVerdict` — the real, already-existing `POST /api/v1/verdicts` action.
--     `verdict === 'SCALE'` → BUDGET_CHANGED (before/after = the real budget numbers
--     `ExecuteVerdictResponseDto.previousValue`/`.newValue` already carry); every other verdict
--     (PAUSE/FIX/REFRESH) → VERDICT_APPLIED.
--   - `SchedulerService`'s real `createPropertyCampaign` success path (`recordCampaignTriggerDecision`,
--     `FULL_CONTROL` branch) — CAMPAIGN_PUBLISHED, only for a real (non-`simulated`) LIVE-mode
--     result — a DEV-mode `SIMULATED` result writes no audit row (nothing real to audit yet, same
--     "never fabricate a completed real-world action" discipline this table's own purpose demands).
--
-- REAL ROLLBACK COVERAGE (investigated, not invented — see `AuditLogService.rollback`'s own doc):
-- only `CAMPAIGN_PUBLISHED` is `reversible = true` — its real, safe, ALREADY-EXISTING reverse
-- operation is `MetaAdsService.executeVerdict({verdict: 'PAUSE', targetType: 'campaign'})` against
-- the same real campaign id, the exact same code path a manager clicking "Pause" on that campaign
-- anywhere else in this app already goes through. `VERDICT_APPLIED`/`BUDGET_CHANGED` are honestly
-- `reversible = false`: reversing a PAUSE/FIX/REFRESH verdict, or restoring an arbitrary previous
-- budget number, would need a raw "set to exactly X" capability `@aos/meta-ads-connector` (a
-- hard-constrained, already-shipped, independently-verified package this session does not modify)
-- does not expose — there is no honest, safe reverse call to wire today, so this phase does NOT
-- build a rollback button that would not actually revert anything. `VERDICT_REJECTED` is always
-- `reversible = false` — a reject already did nothing to undo.
--
-- `related_verdict_id`/`related_brief_id` are both free, nullable TEXT (no FK — same
-- no-cross-table-FK convention this whole migration folder already establishes) — `related_verdict_id`
-- holds the real `pending_agent_actions.id` (for the approve/reject writers) or the real
-- `targetId` (for the executeVerdict writer) when one exists; `related_brief_id` is reserved for a
-- future `CREATIVE_GENERATED` writer this phase does not add (no real, already-existing creative-
-- generation call site maps honestly onto this table's own decided_by/mode shape without further
-- design — left `NULL` rather than a fabricated wire).
--
-- NOT auto-applied by this repo's tooling — run this against the real Supabase project before
-- `AuditLogService.record`/`.rollback` can persist a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE audit_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          TEXT NOT NULL,

  agent              TEXT NOT NULL
                        CHECK (agent IN ('SAMANTHA', 'KAI', 'CLARA', 'KAREN')),

  action_type        TEXT NOT NULL
                        CHECK (action_type IN (
                          'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
                          'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK'
                        )),

  before_state       JSONB,
  after_state        JSONB,

  decided_by         TEXT NOT NULL
                        CHECK (decided_by IN ('ai_auto', 'user_manual')),
  -- Nullable exactly when decided_by = 'ai_auto' — same "never fabricate an actor" convention
  -- `learning_proposals.decided_by`/`pending_agent_actions.decided_by` already establish.
  user_id            TEXT,

  mode               TEXT NOT NULL CHECK (mode IN ('DEV', 'LIVE')),

  related_verdict_id TEXT,
  related_brief_id   TEXT,

  reversible         BOOLEAN NOT NULL DEFAULT false,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_tenant_created  ON audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_tenant_agent    ON audit_log(tenant_id, agent);
CREATE INDEX idx_audit_log_reversible      ON audit_log(tenant_id, reversible) WHERE reversible;

-- RLS — mirrors `024_learning_proposals.sql`'s/`031_operating_mode.sql`'s real policy SHAPE exactly
-- (same `auth.jwt() -> 'user_metadata'` convention). SELECT only — the real writer is
-- `AuditLogService`/`AuditLogRepository`, which goes through aaos-api's own service-role Supabase
-- client (the SAME `SUPABASE_CLIENT` every other aaos-api-owned table's writer uses), never the
-- anon-key browser client.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_audit_log" ON audit_log
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
