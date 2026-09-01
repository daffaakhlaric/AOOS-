-- AAOS-AI-JUDGE-SELF-IMPROVING (Phase J2) -- 029_judge_results.sql
-- Backs the new `modules/ai-judge` (`AiJudgeService`/`JudgeResultRepository`) -- a real, per-run,
-- LLM-scored judgment of one `agent_runs` row (Phase J1, `028_agent_runs.sql`), one row per real
-- judge call. This is the LIVE-run-only judging path -- it does NOT touch or replace
-- `SimulationService`'s existing `computeSimulationScoring`/`domain/scoring.ts`, which stays
-- exactly as-is for simulations (see docs/PROMPT-AAOS-AI-JUDGE-SELF-IMPROVING.md, Phase J2's own
-- doc: "a parallel, LIVE-run-only judging path, not a replacement").
--
-- Real next migration number verified directly against this folder's actual latest
-- (028_agent_runs.sql) before choosing 029 -- no other 029 exists.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `JudgeResultRepository.insert` can persist real rows.

CREATE TABLE judge_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,

  -- SAMANTHA | KAI | CLARA, per CLAUDE.md's real agent roster -- free TEXT (never a CHECK enum),
  -- same convention every prior `agent` column in this migration folder follows
  -- (021_agent_activities.sql's own documented reasoning, restated on `028_agent_runs.sql`).
  agent       TEXT NOT NULL,

  -- The real `agent_runs.id` this judgment scores. A real FK is possible here (unlike
  -- `agent_runs.run_ref`'s own polymorphic pointer) because both tables live in this app's own
  -- `public` schema.
  run_id      UUID REFERENCES agent_runs(id),

  -- Per-dimension scores (0-100, real per-agent dimension vocabulary -- see
  -- `LlmService.judgeAgentRun`'s own doc / `dto/judge-agent-run.dto.ts` for the exact real keys
  -- per agent) PLUS a real `overall` weighted score -- one JSONB blob, never split into individual
  -- columns, so a future dimension never needs a migration (same "free-shape JSONB for
  -- judge-only, LLM-authored content" reasoning `learning_proposals.gaps`/`.improvements` already
  -- establish in `024_learning_proposals.sql`).
  scores      JSONB NOT NULL,

  -- Real, LLM-authored qualitative notes -- an array of short strength statements. Nullable: not
  -- every judge response is guaranteed to include any (though `dto/judge-agent-run.dto.ts`'s real
  -- Zod schema always requires the key; nullable here is defensive against a manually-inserted or
  -- future non-LLM row).
  strengths   JSONB,

  -- Real, LLM-authored gap items (`dimension`/`score`/`issue`/`severity`/`suggestion` each) -- the
  -- same real shape `dto/judge-agent-run.dto.ts`'s `JudgeGapSchema` validates before this table is
  -- ever written to.
  gaps        JSONB,

  -- Real, LLM-authored free-text notes for the judged agent -- never fabricated by app code.
  notes       TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_judge_results_tenant_agent    ON judge_results(tenant_id, agent);
CREATE INDEX idx_judge_results_tenant_created  ON judge_results(tenant_id, created_at DESC);

-- RLS -- mirrors `028_agent_runs.sql`'s `manager_view_own_tenant_agent_runs` policy SHAPE exactly
-- (same `auth.jwt() -> 'user_metadata' ->> 'role'`/`tenantId` convention). SELECT-only, on
-- purpose: every real write to this table goes through `JudgeResultRepository.insert` on the
-- service-role-backed `SUPABASE_CLIENT` (same "service-role writer only, no INSERT/UPDATE policy"
-- reasoning every prior migration in this folder that follows this shape documents on itself) --
-- a manager's browser client (anon key) only ever reads.
ALTER TABLE judge_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_judge_results" ON judge_results
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
