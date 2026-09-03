-- AAOS-SELF-IMPROVING (Phase SI-4) -- 038_sandbox_config.sql
-- Seeds the real `agent_configs` row `SandboxService.testImprovement` resolves via
-- `AgentConfigService.get(tenantId, "SANDBOX", "min_delta_to_apply", 3)` -- the design doc's own
-- spec ("SANDBOX bucket, default 3"), never a hardcoded literal in application code (same real
-- "every config threshold goes through AgentConfigService.get" discipline `034_agent_configs.sql`
-- already established for `pause_cpl_multiplier`/`live_run_gap_threshold`).
--
-- Real next migration number verified directly against this folder's actual latest
-- (037_learning_proposals_self_analysis.sql) before choosing 038 -- no other 038 exists.
--
-- No new table -- `agent_configs` (034) already has the exact `(tenant_id, agent, config_key,
-- value, data_type, description, updated_by)` shape this needs; `"SANDBOX"` is a NEW, real `agent`
-- bucket value (free TEXT, same reasoning `034`'s own header doc documents for `"GLOBAL"`) --
-- `min_delta_to_apply` is not owned by any single real agent (SI-5's own future auto-apply gate
-- will read it the same way for SAMANTHA/CLARA both), so a dedicated `"SANDBOX"` bucket is the
-- honest choice, not a 4th real agent.
--
-- ZERO-BEHAVIOR-CHANGE DISCIPLINE: seeded value (3) is the EXACT default `SandboxService`'s own
-- `DEFAULT_MIN_DELTA` fallback constant already uses -- this migration only makes that value
-- editable via a future Config editor UI (Phase SI-6), it changes nothing about today's real
-- behavior until a human or a real future auto-applied change actually edits this row.
--
-- Idempotent (`ON CONFLICT (tenant_id, agent, config_key) DO NOTHING`), same convention `034`'s own
-- seed rows already establish -- safe to re-run, never overwrites a value a human has since
-- legitimately changed via `AgentConfigService.set`. Seeded for `dss-motor`, the one real tenant
-- this whole session's fixtures/seeds already target.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `AgentConfigService.get(tenantId, "SANDBOX", "min_delta_to_apply", 3)` can read a real
-- tenant-customized row (it already falls open to the same real default `3` without this row, per
-- `AgentConfigService.get`'s own "never throws, always a real, honest default" doc).

INSERT INTO agent_configs (tenant_id, agent, config_key, value, data_type, description, updated_by)
VALUES
  (
    'dss-motor', 'SANDBOX', 'min_delta_to_apply', '3', 'number',
    'SandboxService.testImprovement (AAOS Self-Improving, Phase SI-4): a candidate improvement is honestly considered "improved" only when sandboxScore - baselineScore is at least this much (same real AI Judge overall 0-100 scale judge_results.scores.overall already uses).',
    'migration:038_sandbox_config'
  )
ON CONFLICT (tenant_id, agent, config_key) DO NOTHING;
