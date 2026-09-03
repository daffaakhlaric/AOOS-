-- AAOS-SELF-IMPROVING (Phase SI-1) -- 034_agent_configs.sql
-- Backs the new `modules/agent-config` (`AgentConfigService`/`AgentConfigRepository`) -- a real,
-- DB-backed numeric-config override layer, the CONFIG_UPDATE sibling of Phase A's real
-- `agent_prompt_overrides` (`022_agent_prompt_overrides.sql`). Real finding this phase corrects
-- (see `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s own header): `023_agent_config_overrides.sql`'s
-- `config_key` column has been INERT since it was added (no real config key was ever wired to
-- anything -- `LlmService.generateImprovementPlan`'s own doc says so directly) -- this is a NEW,
-- separate table for THIS phase's 2 real, concrete config values rather than trying to resurrect
-- that inert one, so this table's own `config_key` vocabulary starts real from row one.
--
-- Real next migration number verified directly against this folder's actual latest
-- (033_listings_kecamatan.sql) before choosing 034 -- no other 034 exists.
--
-- `tenant_id`/no-FK-to-tenants follows the SAME convention `020_tenant_mode.sql`/
-- `021_agent_activities.sql`/`022_agent_prompt_overrides.sql` already establish for this app (free
-- `TEXT`, no FK -- every other aaos-api-owned table in this migration folder makes the same
-- choice).
--
-- `agent` is free TEXT (not a CHECK enum), same reasoning `022_agent_prompt_overrides.sql`'s own
-- `agent` column documents on itself -- SAMANTHA today for `pause_cpl_multiplier`, plus a real
-- `GLOBAL` bucket (not a 4th real agent -- a documented, deliberate choice, see
-- `AgentConfigService`'s own doc) for `live_run_gap_threshold`, which gates BOTH Samantha's and
-- Clara's real LIVE-run learning trigger (`LearningService.onAgentRunJudged`) and so has no single
-- honest per-agent owner.
--
-- `value` is TEXT (not NUMERIC) so a future non-numeric config value never needs a column-type
-- migration -- `AgentConfigService.get`/`.set` are the real numeric-parse boundary, same
-- "Zod/service validates, DB just stores it" convention `tenants.mode` documents on itself.
-- `data_type` is a real, human-readable hint for a future Config editor UI (Phase SI-6) -- 'number'
-- for both of this phase's real rows, never enforced by a DB CHECK (the service layer is the real
-- boundary, per this column's own reasoning).
--
-- UNIQUE (tenant_id, agent, config_key) is a REAL DB constraint here (unlike
-- `agent_prompt_overrides`'s own "enforced at the service layer" choice for is_active) because this
-- table has no version history to reconcile -- `AgentConfigRepository.upsert` is a real
-- read-then-insert-or-update (the shared `SupabaseClientLike` port has no native `.upsert()`, same
-- reasoning `meta_interests`' own `MetaInterestRepository.save` documents on itself), and this
-- constraint is the real safety net against a concurrent double-insert race that read-then-write
-- alone cannot fully prevent.
--
-- Seed rows below are IDEMPOTENT (`ON CONFLICT (tenant_id, agent, config_key) DO NOTHING`), same
-- "migration-agnostic seeding" convention this phase's own coordinator note asks for -- safe to
-- re-run, and never overwrites a value a human/AI has since legitimately changed via
-- `AgentConfigService.set`. Seeded for `dss-motor` (`AAOS_TENANT_ID`, `.env.example`) -- the one
-- real tenant this whole session's fixtures/seeds already target (e.g. `agent_prompt_overrides`'
-- own real fallback prompt is DSS Motor-branded).
--
-- REAL, ZERO-BEHAVIOR-CHANGE DISCIPLINE: both seeded values are the EXACT current hardcoded
-- constants they rewire -- `pause_cpl_multiplier = 1.5`
-- (`modules/scheduler/domain/campaign-trigger.ts`'s `HIGH_CPL_MULTIPLIER`) and
-- `live_run_gap_threshold = 60` (`modules/learning/learning.service.ts`'s `LIVE_RUN_GAP_THRESHOLD`)
-- -- so this migration's rollout changes NOTHING about today's real production behavior until a
-- human or a real auto-applied CONFIG_UPDATE improvement actually changes one of these rows.
--
-- Read/write both from `AgentConfigRepository` on the SAME shared `SUPABASE_CLIENT`
-- service-role client every other aaos-api-owned table's writer uses -- never a second connection,
-- never the anon-key browser client for writes.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `AgentConfigService.get`/`.set` can read/write a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE agent_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,

  -- SAMANTHA | GLOBAL today -- free TEXT, same reasoning `022_agent_prompt_overrides.sql`'s own
  -- `agent` column documents on itself: a future 3rd real bucket should never need a migration.
  agent        TEXT NOT NULL,

  -- e.g. 'pause_cpl_multiplier' | 'live_run_gap_threshold' -- see this file's header doc for the 2
  -- real keys this phase wires up. Free TEXT, not a CHECK enum, so a future new config key never
  -- needs a migration to become overridable (same reasoning `agent_prompt_overrides.prompt_key`
  -- documents on itself).
  config_key   TEXT NOT NULL,

  -- Free TEXT -- `AgentConfigService` is the real numeric-parse boundary. See this file's header
  -- doc for why NUMERIC was deliberately not chosen.
  value        TEXT NOT NULL,

  -- Real, human-readable hint for a future Config editor UI (Phase SI-6) -- 'number' for both of
  -- this phase's real rows. Never enforced by a DB CHECK (see header doc).
  data_type    TEXT NOT NULL DEFAULT 'number',

  -- Real, human-readable explanation of what this config value controls -- shown by a future
  -- Config editor UI (Phase SI-6), never parsed by app code.
  description  TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Free TEXT -- a human manager's identifier (Config editor UI, Phase SI-6) OR a real, honest
  -- "AI_AUTO_APPLY" marker (`ConfigApplierService.applyConfigUpdate`'s own real writer identity) --
  -- never fabricated, always says who/what actually wrote this value.
  updated_by   TEXT,

  UNIQUE (tenant_id, agent, config_key)
);

CREATE INDEX idx_agent_configs_lookup ON agent_configs(tenant_id, agent, config_key);

-- RLS -- mirrors `022_agent_prompt_overrides.sql`'s `manager_view_own_tenant_prompt_overrides`
-- policy SHAPE exactly (same `auth.jwt() -> 'user_metadata'` convention). SELECT only: a
-- manager/owner can see their own tenant's config rows (e.g. a future Config editor UI, Phase
-- SI-6) -- no INSERT/UPDATE policy, same "service-role writer only" reasoning every prior migration
-- in this folder that follows this shape documents on itself -- `AgentConfigService.set`'s real
-- writer (human Config editor OR `ConfigApplierService`'s real auto-apply) goes through the
-- service-role `SUPABASE_CLIENT`, which bypasses RLS entirely.
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_agent_configs" ON agent_configs
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- Idempotent seed -- see header doc. Real current hardcoded values, zero behavior change on
-- rollout.
INSERT INTO agent_configs (tenant_id, agent, config_key, value, data_type, description, updated_by)
VALUES
  (
    'dss-motor', 'SAMANTHA', 'pause_cpl_multiplier', '1.5', 'number',
    'CPL more than this multiplier above a listing''s benchmark CPL counts as HIGH_CPL for the PROPERTY campaign-trigger check (modules/scheduler/domain/campaign-trigger.ts, HIGH_CPL_MULTIPLIER).',
    'migration:034_agent_configs'
  ),
  (
    'dss-motor', 'GLOBAL', 'live_run_gap_threshold', '60', 'number',
    'A judged live agent run (SAMANTHA or CLARA) with judge_results.scores.overall below this value triggers a real learning-proposal gap check (modules/learning/learning.service.ts, LIVE_RUN_GAP_THRESHOLD).',
    'migration:034_agent_configs'
  )
ON CONFLICT (tenant_id, agent, config_key) DO NOTHING;
