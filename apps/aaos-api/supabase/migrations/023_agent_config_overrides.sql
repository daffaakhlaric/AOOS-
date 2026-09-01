-- AAOS Self-Learning AI (Phase A) -- 023_agent_config_overrides.sql
-- Backs Kai's only real "learnable" surface (docs/PROMPT-AAOS-SELF-LEARNING-AI.md's Finding #2:
-- Kai has no chat-LLM system prompt at all -- its real pipeline is deterministic, non-LLM; its only
-- learnable surface is numeric config, e.g. a copy-length cap -- never a prompt string).
--
-- Same free-`TEXT`/no-FK-to-tenants convention as `022_agent_prompt_overrides.sql`/
-- `021_agent_activities.sql`/`020_tenant_mode.sql`.
--
-- INERT SCHEMA in Phase A -- there is no numeric-config-driven behavior in Kai's real pipeline
-- (`FormatDecisionService`/`PromptBuildingService`/`CopyBuilder`) for this phase to wire a reader
-- into yet, and no writer either (same Phase C-is-the-only-real-writer reasoning
-- `022_agent_prompt_overrides.sql` documents). This table is created honestly as-designed, matching
-- the design doc's explicit Phase A scope -- NOT wired to a fabricated Kai config consumer.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before any
-- future phase can read/write a real per-tenant Kai config override.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE agent_config_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,

  -- Free TEXT, same "no CHECK enum, future agent needs no migration" reasoning
  -- `022_agent_prompt_overrides.sql`'s `agent` column documents on itself. KAI today (Finding #2);
  -- SAMANTHA/CLARA config overrides are not ruled out for a future phase.
  agent        TEXT NOT NULL,

  -- e.g. 'copy_length_cap' -- free TEXT, same "future key needs no migration" reasoning as `agent`.
  config_key   TEXT NOT NULL,

  -- Stored as TEXT (not NUMERIC) so this table can hold any config value regardless of
  -- `data_type` -- `data_type` documents how a real reader should parse it (Kai's numeric config
  -- today; not restricted to numbers only, for the same "no future migration needed" reasoning).
  value        TEXT NOT NULL,
  data_type    TEXT NOT NULL DEFAULT 'number',

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, agent, config_key)
);

CREATE INDEX idx_agent_config_overrides_lookup ON agent_config_overrides(tenant_id, agent);

-- RLS -- same SELECT-only shape as `022_agent_prompt_overrides.sql`'s policy (see that file's doc
-- for why no INSERT/UPDATE policy is added speculatively).
ALTER TABLE agent_config_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_config_overrides" ON agent_config_overrides
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
