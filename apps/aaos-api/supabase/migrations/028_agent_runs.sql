-- AAOS-AI-JUDGE-SELF-IMPROVING (Phase J1) -- 028_agent_runs.sql
-- Backs the new `modules/agent-runs` (`AgentRunsService`/`AgentRunRepository`) -- a small,
-- POINTER-STYLE table recording that a real per-agent run happened, with just enough real
-- context for a later judge prompt (Phase J2, not built here) to work from. This is NOT a second
-- copy of `calendar_events`/`creative_packages`/`conversations` -- `run_ref` points back at the
-- real source row, `context` is a small, hand-picked summary, never a full duplicate.
--
-- See docs/PROMPT-AAOS-AI-JUDGE-SELF-IMPROVING.md, Finding 3 / Phase J1: judgeable "run" data
-- exists in different shapes per agent today (`calendar_events.result` for Samantha,
-- `creative_packages` for Kai, `packages/lead-store`'s `conversations`/`closings` for Clara) --
-- this table is the one real, missing, per-run POINTER row tying them together for judging,
-- polymorphic by `agent`:
--   - SAMANTHA: run_ref = calendar_events.id (the SAMANTHA_ANALYZE event this row summarizes)
--   - KAI:      run_ref = creative_packages.id
--   - CLARA:    run_ref = leads.id (the real, honest terminal-state pointer chosen for Clara --
--               `RecordClosing` closes a LEAD, not a single `conversations` row, and is the only
--               real, honest "this conversation's outcome is judgeable now" transition wired in
--               this phase -- see `ClosingsService.createClosing`'s own doc comment: "This is the
--               ONLY way a lead's status becomes CLOSED")
--
-- Real next migration number verified directly against this folder's actual latest
-- (027_agent_activities_needs_human.sql) before choosing 028 -- no other 028 exists.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `AgentRunsService.record` can persist real rows.

CREATE TABLE agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,

  -- SAMANTHA | KAI | CLARA, per CLAUDE.md's real agent roster -- free TEXT (never a CHECK enum),
  -- matching every prior `agent` column in this migration folder (021_agent_activities.sql's own
  -- documented reasoning: "a future 5th agent never needs a migration to be logged").
  agent       TEXT NOT NULL,

  -- The real pointer described above -- polymorphic by `agent`, resolved app-side (this table
  -- carries no FK: its 3 real targets live in 2 different schemas -- `calendar_events`/
  -- `creative_packages` in this app's own `public` schema, `leads` in `packages/lead-store`'s
  -- schema -- so a single real FK constraint here is not honestly possible).
  run_ref     TEXT NOT NULL,

  -- A small, judge-prompt-sized real summary -- never a full duplicate of the source row. See
  -- `AgentRunsService.record`'s call sites for the real, honest shape chosen per agent.
  context     JSONB NOT NULL,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_tenant_agent    ON agent_runs(tenant_id, agent);
CREATE INDEX idx_agent_runs_tenant_created  ON agent_runs(tenant_id, created_at DESC);

-- RLS -- mirrors 021_agent_activities.sql's `manager_view_own_tenant_activities` policy SHAPE
-- exactly (same `auth.jwt() -> 'user_metadata' ->> 'role'`/`tenantId` convention). SELECT-only, on
-- purpose: every real write to this table goes through `AgentRunsService.record` on the
-- service-role-backed `SUPABASE_CLIENT` (same "service-role writer only, no INSERT/UPDATE policy"
-- reasoning every prior migration in this folder that follows this shape documents on itself) --
-- a manager's browser client (anon key) only ever reads.
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_agent_runs" ON agent_runs
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
