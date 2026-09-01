-- AAOS Self-Learning AI (Phase B) -- 024_learning_proposals.sql
-- Backs the new gap-detection + LLM-generated improvement PROPOSAL layer (`modules/learning`'s
-- `LearningService`/`LearningProposalRepository`), per docs/PROMPT-AAOS-SELF-LEARNING-AI.md's
-- "Phase B — Gap detection + LLM-generated improvement PROPOSAL (never auto-applied)" section.
--
-- HARD RULE, confirmed explicitly by the user: nothing in Phase B ever writes an active
-- `agent_prompt_overrides`/`agent_config_overrides` row -- this table only ever holds a `PENDING`
-- proposal for a human to later review. That human-approval write path is Phase C, a separate,
-- later effort (see this file's `status`/`decided_by`/`decision_notes`/`decided_at` columns below,
-- which exist for Phase C to populate -- Phase B's own writer, `LearningService`, only ever inserts
-- a row with `status = 'PENDING'` and every decision column left NULL).
--
-- `tenant_id`/no-FK-to-tenants follows the SAME convention `020_tenant_mode.sql`/
-- `021_agent_activities.sql`/`022_agent_prompt_overrides.sql` already establish for this app (free
-- `TEXT`, no FK -- every other aaos-api-owned table in this migration folder makes the same
-- choice).
--
-- `simulation_id` REFERENCES the real `simulations(id)` table (`001_simulations.sql`) -- verified
-- directly rather than assumed. NULL-able: a future non-simulation trigger source for a learning
-- proposal is plausible (e.g. real-world CPL/closing reconciliation, Phase D, deferred), but for
-- THIS phase it is always populated (`LearningService.onSimulationComplete`'s only real call site).
--
-- `agent` is free TEXT (not a CHECK enum), same reasoning `021_agent_activities.sql`'s/
-- `022_agent_prompt_overrides.sql`'s own `agent` columns document on themselves: SAMANTHA | CLARA
-- today (Kai has no chat-LLM prompt -- see the design doc's Finding #2), but a future 5th agent
-- should never need a migration just to get an improvement proposal.
--
-- `decided_by`/`decision_notes`/`decided_at` mirror `StoredSimulation.decision`/`decidedBy`/
-- `decisionNotes`/`decidedAt` (the real Go-Live approval shape, design doc Finding #5) -- the same
-- real, reusable "AI recommendation needs a human decision" pattern, reused here rather than a
-- second decision mechanic being invented.
--
-- Read-only from `LearningService` in Phase B -- it only ever INSERTs a `PENDING` row (plus,
-- separately, reads recent `PENDING`/decided rows for a tenant as LLM context -- see
-- `LearningProposalRepository.listRecentForTenant`). The real Approve/Reject writer that sets
-- `status`/`decided_by`/`decision_notes`/`decided_at` is Phase C (a later, separate effort: the
-- dashboard Learning Monitor), which will go through aaos-api's own service-role Supabase client
-- (the SAME `SUPABASE_CLIENT` every other aaos-api-owned table's writer uses), never the anon-key
-- browser client -- so no INSERT/UPDATE RLS policy is added here speculatively (same reasoning
-- `022_agent_prompt_overrides.sql`'s header doc gives for its own SELECT-only policy).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LearningService.onSimulationComplete` can persist a real proposal row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE learning_proposals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,

  -- The real simulation whose gap this proposal was generated from. NULL-able (see header doc),
  -- always populated in Phase B. ON DELETE SET NULL so a (hypothetical, this app has no real
  -- delete path for `simulations` today) simulation row deletion never cascades into losing a real
  -- proposal's own analysis/gaps/improvements -- the proposal remains a real historical record.
  simulation_id  UUID REFERENCES simulations(id) ON DELETE SET NULL,

  -- SAMANTHA | CLARA today -- free TEXT, same reasoning `021_agent_activities.sql`'s/
  -- `022_agent_prompt_overrides.sql`'s own `agent` columns document on themselves.
  agent          TEXT NOT NULL,

  -- The LLM's real qualitative analysis of the gap (`LlmService.generateImprovementPlan`'s
  -- `analysis` field) -- free text, never a fabricated numeric summary.
  analysis       TEXT,

  -- The real gap data `LearningService` detected (scores/verdict/feedbackItems) that triggered
  -- this proposal -- see `LearningService`'s own doc for the exact criteria. JSONB, not a fixed
  -- column set, since the real `SimulationScoring`/`ClaraPersonaRun.feedbackItems` shape may grow.
  gaps           JSONB NOT NULL,

  -- The LLM-proposed, server-validated improvement plan (`{ agent, type, target, before, after,
  -- reason }[]` -- see `LlmService.generateImprovementPlan`'s Zod schema). Server-validated against
  -- Phase A's real `prompt_key` vocabulary before being stored here -- any improvement targeting an
  -- unknown key is dropped before this INSERT, never stored unvalidated.
  improvements   JSONB NOT NULL,

  status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- Decision columns -- Phase B never populates these (every row Phase B inserts leaves them NULL,
  -- `status = 'PENDING'`). They exist now so Phase C's Approve/Reject action has real columns to
  -- write into without a further migration, mirroring `StoredSimulation.decision`/`decidedBy`/
  -- `decisionNotes`/`decidedAt`'s shape (design doc Finding #5).
  decided_by     TEXT,
  decision_notes TEXT,
  decided_at     TIMESTAMPTZ,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_proposals_tenant           ON learning_proposals(tenant_id);
CREATE INDEX idx_learning_proposals_tenant_agent      ON learning_proposals(tenant_id, agent);
CREATE INDEX idx_learning_proposals_tenant_status     ON learning_proposals(tenant_id, status);
CREATE INDEX idx_learning_proposals_tenant_created    ON learning_proposals(tenant_id, created_at DESC);
CREATE INDEX idx_learning_proposals_simulation        ON learning_proposals(simulation_id);

-- RLS -- mirrors `021_agent_activities.sql`'s `manager_view_own_tenant_activities` policy SHAPE
-- exactly (same `auth.jwt() -> 'user_metadata'` convention). SELECT only: a manager/owner can see
-- their own tenant's proposal rows (e.g. a future Learning Monitor "what's pending review" read,
-- Phase C) -- no INSERT/UPDATE policy, per this file's header doc (Phase B's real writer and
-- Phase C's real Approve/Reject writer both go through the service-role client, which bypasses RLS
-- entirely, same as every other aaos-api-owned table's writer in this app).
ALTER TABLE learning_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_learning_proposals" ON learning_proposals
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
