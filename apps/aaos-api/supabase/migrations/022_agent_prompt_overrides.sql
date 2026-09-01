-- AAOS Self-Learning AI (Phase A) -- 022_agent_prompt_overrides.sql
-- Backs the new DB-backed prompt/config override layer (`modules/prompt-override`'s
-- `PromptOverrideService`/`PromptOverrideRepository`), the prerequisite infrastructure for
-- docs/PROMPT-AAOS-SELF-LEARNING-AI.md's Self-Learning AI effort (Finding #2: no agent's real
-- prompt is DB-driven anywhere in this codebase today).
--
-- `tenant_id`/no-FK-to-tenants follows the SAME convention `020_tenant_mode.sql`/
-- `021_agent_activities.sql`/`016_intelligence.sql` already establish for this app (free `TEXT`,
-- no FK -- every other aaos-api-owned table in this migration folder makes the same choice).
--
-- `agent` is free TEXT (not a CHECK enum), same reasoning `021_agent_activities.sql`'s own `agent`
-- column documents on itself: SAMANTHA | CLARA today, but a future 5th agent should never need a
-- migration just to be logged/overridden.
--
-- Read-only from `PromptOverrideRepository` in Phase A -- nothing in this phase ever INSERTs a row
-- here. The real writer is Phase C (a later, separate effort: the dashboard Learning Monitor's
-- Approve action), which will go through aaos-api's own service-role Supabase client (the SAME
-- `SUPABASE_CLIENT` every other aaos-api-owned table's writer uses), never the anon-key browser
-- client -- so no INSERT/UPDATE RLS policy is added here speculatively (see this migration's SELECT
-- policy doc below for why SELECT alone is real, in-scope infrastructure today).
--
-- "At most one is_active=true row per (tenant_id, agent, prompt_key)" is enforced at the SERVICE
-- layer (Phase C's writer), not a DB constraint -- same "Zod/service validates, DB just stores it"
-- convention `tenants.mode` documents on itself.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `PromptOverrideService.resolve` can read a real per-tenant override.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE agent_prompt_overrides (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT NOT NULL,

  -- SAMANTHA | CLARA today (Kai has no chat-LLM prompt -- see the design doc's Finding #2) -- free
  -- TEXT, same reasoning `021_agent_activities.sql`'s own `agent` column documents on itself.
  agent          TEXT NOT NULL,

  -- e.g. 'analyze' | 'creative_brief' | 'campaign_strategy' | 'select_targeting' |
  -- 'resolve_location' | 'asset_insight' | 'chat' | 'generate_caption' | 'generate_hashtags' |
  -- 'clara_system_prompt' -- one real, stable key per real prompt this phase wires up (see
  -- `LlmService`'s `resolve(...)` call sites and `buildClaraPrompt`'s `promptOverride` param). Free
  -- TEXT, not a CHECK enum, so a future new prompt never needs a migration to become overridable.
  prompt_key     TEXT NOT NULL,

  content        TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  is_active      BOOLEAN NOT NULL DEFAULT true,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at   TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,

  UNIQUE (tenant_id, agent, prompt_key, version)
);

CREATE INDEX idx_agent_prompt_overrides_lookup
  ON agent_prompt_overrides(tenant_id, agent, prompt_key, is_active);

-- RLS -- mirrors `021_agent_activities.sql`'s `manager_view_own_tenant_activities` policy SHAPE
-- exactly, adapted to this table (same `auth.jwt() -> 'user_metadata'` convention). SELECT only: a
-- manager/owner can see their own tenant's override rows (e.g. a future Learning Monitor "what
-- prompt is live right now" read), matching what this phase actually needs -- no INSERT/UPDATE
-- policy, per this file's header doc (Phase C's real writer goes through the service-role client,
-- which bypasses RLS entirely, same as every other aaos-api-owned table's writer in this app).
ALTER TABLE agent_prompt_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_prompt_overrides" ON agent_prompt_overrides
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
