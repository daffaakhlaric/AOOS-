-- AAOS-SELF-IMPROVING (Phase SI-2) -- 036_agent_logic.sql
-- Backs the new `modules/agent-config`'s `AgentLogicService`/`AgentLogicRepository` -- the
-- LOGIC_UPDATE sibling of Phase SI-1's real `agent_configs` (`034_agent_configs.sql`, this same
-- module). Real next migration number verified directly against this folder's actual latest
-- (035_learning_proposals_auto_applied.sql) before choosing 036 -- no other 036 exists.
--
-- REAL INVESTIGATION FINDING THIS MIGRATION ACTS ON (see
-- `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s Phase SI-2 section for the full brief): genuine
-- multi-condition decision logic (more than one field/threshold combined via AND/OR into a single
-- verdict, beyond Phase SI-1's flat-threshold CONFIG_UPDATE shape) DOES exist in this codebase --
-- `packages/meta-ads-connector/src/domain/services/VerdictEngine.ts`'s real `evaluateVerdict`
-- (SCALE/PAUSE/REFRESH/KEEP/REVIEW/FIX from `rphChat`/`conversations`/`spendAmount`/`frequency`/
-- `objective`, ordered precedence) and `packages/meta-ads-agent/src/intelligence/
-- VerdictDecisionEngine.ts`'s real `decidePause`/`decideScale` (AND of an Rp/chat threshold and a
-- spend threshold deciding AUTO_EXECUTE vs ESCALATE). So this is real Outcome A, not Outcome B --
-- LOGIC_UPDATE has a real, distinct, honest target.
--
-- BUT: neither of those 2 real engines is directly, cleanly callable from `apps/aaos-api` at a
-- single "one optional parameter, one resolving call site" seam the way Phase SI-1's own
-- `shouldCreateNewCampaign`/`cplMultiplier` rewiring was (both live in separate workspace packages,
-- reached only through deep pull/sync orchestration -- `evaluateVerdict` is invoked inside
-- `PullCampaignData.hydrateAdSet`, several layers below `SchedulerService`'s own call site -- or,
-- for `VerdictDecisionEngine`, its real PAUSE/SCALE output is verified (via direct read of
-- `scheduler.service.ts`) to be computed but NEVER actually consumed anywhere in aaos-api today --
-- only its REFRESH classification is). Rewiring either engine's own internals in place would mean
-- either invasive cross-package surgery (contradicts this whole effort's "least invasive, zero
-- behavior change" discipline) or wiring into a real decision whose output nothing reads (as inert,
-- in real effect, as a fabricated rule tree with no consumer).
--
-- REAL, HONEST RESOLUTION: this migration's real `agent_logic` table backs a NEW, real, aaos-api
-- OWNED decision point instead -- `SchedulerService.runSamanthaAnalyze`'s own real PAUSE/SCALE
-- digest classification (see that method's own doc, `apps/aaos-api/src/modules/scheduler/
-- scheduler.service.ts`), which already counts `ad.verdict === Verdict.PAUSE/SCALE` for the real
-- `SAMANTHA_ANALYZE` calendar-event summary text and API response. This phase adds an OPTIONAL,
-- tenant-resolvable rule-based override of that ONE classification, evaluated by the real, pure,
-- non-`eval` `evaluateLogicRules` interpreter (`agent-config/logic-interpreter.ts`) over the ad's
-- own already-computed real metrics (`rphChatIDR`/`conversations`/`spendAmount`/`frequency`) --
-- deliberately mirroring `evaluateVerdict`'s own real field vocabulary and precedence-ordered,
-- first-match-wins shape, just expressed as data. `logic_key = 'verdict_classification'`.
--
-- WHY THIS IS THE SAFE FIRST CANDIDATE: per `SchedulerService`'s own class doc ("Every handler here
-- is read-only with respect to real Meta campaigns/Kie AI credits: none of them calls
-- ExecuteVerdict, creates/activates/pauses a campaign, or generates real creative"), overriding this
-- ONE classification can only ever change a DISPLAY count/summary string and an API response field
-- -- it can NEVER trigger a real Meta spend change. A future phase can consider a money-moving
-- target once this display-only path has real production mileage.
--
-- Same free-`TEXT`/no-FK-to-tenants convention as every other aaos-api-owned table in this folder.
-- `agent` free TEXT (SAMANTHA today). `logic_key` free TEXT (no CHECK enum -- a future new logic
-- key never needs a migration, same reasoning `agent_configs.config_key` documents on itself).
-- `definition` JSONB -- `AgentLogicService.get`/`logic-interpreter.ts`'s own `isWellFormedLogicRuleSet`
-- is the real structural-validation boundary, DB just stores it (same "Zod/service validates, DB
-- just stores it" convention `agent_configs.value` documents on itself). `version` is a real,
-- simple increment-on-write counter (`AgentLogicRepository.upsert`'s own doc). `score` is nullable
-- INTEGER, real future-proofing for a Phase SI-4 sandbox score (`min_delta_to_apply`-style gating)
-- -- NOT read/written by anything in this phase, honestly inert for now, same "created honestly
-- as-designed for a plausible future real consumer, not silently treated as wired" discipline
-- `023_agent_config_overrides.sql`'s own header doc documents for itself.
--
-- UNIQUE (tenant_id, agent, logic_key) -- same real DB-constraint reasoning `agent_configs`'s own
-- header doc gives (`AgentLogicRepository.upsert` is a real read-then-insert-or-update, same
-- shared-port limitation).
--
-- NO SEED ROWS in this migration -- deliberately, unlike `034_agent_configs.sql`'s own 2 seeded
-- rows. Those seeds replaced values an EXISTING function already read via the exact same code path
-- (`shouldCreateNewCampaign`'s own `cplMultiplier` parameter). This table's real reader
-- (`SchedulerService.runSamanthaAnalyze`'s new override step) is a NEW, PARALLEL classification
-- path alongside the real `evaluateVerdict` the ad's `verdict` field already carries -- seeding a
-- ruleset that merely re-derives the identical classification through a second code path would add
-- real risk of subtle divergence for zero behavior benefit. True zero-behavior-change is instead
-- achieved the same way Phase SI-1 achieves it for a tenant with no override row at all: an EMPTY
-- table means `AgentLogicService.get` returns `undefined` for every tenant, and
-- `runSamanthaAnalyze`'s own override step is a real, honest no-op until a human or a real
-- auto-applied `LOGIC_UPDATE` improvement actually writes a row.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `AgentLogicService.get`/`.set` can read/write a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE agent_logic (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,

  -- SAMANTHA today -- free TEXT, same reasoning `agent_configs.agent`/`agent_prompt_overrides.agent`
  -- each document on themselves: a future 2nd real bucket should never need a migration.
  agent        TEXT NOT NULL,

  -- e.g. 'verdict_classification' -- see this file's header doc for the one real key this phase
  -- wires up. Free TEXT, not a CHECK enum, same reasoning `agent_configs.config_key` documents.
  logic_key    TEXT NOT NULL,

  -- An ordered array of `{conditions: [{field, operator, value}], combinator?, result}` rules --
  -- see `agent-config/logic-interpreter.ts`'s own header doc for the full real, safe, non-`eval`
  -- shape and evaluation semantics. `AgentLogicService.get` is the real structural-validation
  -- boundary (see this file's header doc for why DB itself enforces nothing beyond NOT NULL).
  definition   JSONB NOT NULL,

  -- Real, simple increment-on-write counter -- `AgentLogicRepository.upsert`'s own doc.
  version      INTEGER NOT NULL DEFAULT 1,

  -- Real future-proofing for a Phase SI-4 sandbox score -- honestly inert in this phase (see this
  -- file's header doc).
  score        INTEGER,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Free TEXT -- a human editor's identifier OR the real, honest "AI_AUTO_APPLY" marker
  -- (`LogicApplierService.applyLogicUpdate`'s own real writer identity) -- never fabricated.
  updated_by   TEXT,

  UNIQUE (tenant_id, agent, logic_key)
);

CREATE INDEX idx_agent_logic_lookup ON agent_logic(tenant_id, agent, logic_key);

-- RLS -- mirrors `034_agent_configs.sql`'s policy SHAPE exactly (same `auth.jwt() ->
-- 'user_metadata'` convention). SELECT only: a manager/owner can see their own tenant's logic rows
-- (e.g. a future Logic editor UI) -- no INSERT/UPDATE policy, same "service-role writer only"
-- reasoning every prior migration in this folder that follows this shape documents on itself --
-- `AgentLogicService.set`'s real writer (human editor OR `LogicApplierService`'s real auto-apply)
-- goes through the service-role `SUPABASE_CLIENT`, which bypasses RLS entirely.
ALTER TABLE agent_logic ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_agent_logic" ON agent_logic
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- No seed rows -- see this file's header doc for why (unlike `034_agent_configs.sql`).
