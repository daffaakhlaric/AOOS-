-- Samantha Andromeda-Aware Campaign System, Sprint 1 -- 051_andromeda_restructure.sql
--
-- Real next migration number verified directly against this folder's actual latest
-- (050_meta_sync.sql) before choosing 051 -- no other 051 exists.
--
-- REAL SCOPE DECISION (investigated before writing this): this sprint's new detection logic
-- (`SchedulerService.runAndromedaRestructureCheck`, pure `scoreCreativeDiversity`/
-- `evaluateAndromedaRestructureCandidate`) computes its diversity/ad-set-fragmentation score fresh,
-- on read, from the SAME already-pulled `Campaign`/`AdSet`/`Ad` tree every other real scheduler
-- check in this file already loads -- there is no real, honest, immediately-populated need to
-- persist a `meta_campaigns.andromeda_score`-style column this dispatch's own code would actually
-- write every tick: the score is cheap to recompute and always reflects the CURRENT real Meta data,
-- never a stale persisted snapshot. This migration therefore adds NO new table/column for the
-- score itself -- "compute on read, no persistence" is the honest call, matching this sprint's own
-- "never add a column nothing in this dispatch's own code will ever write" discipline.
--
-- The ONE real, additive schema change this sprint's own code DOES need: `pending_agent_actions`
-- already supports a brand-new `action_type` with ZERO migration (031_operating_mode.sql's own
-- `action_type` column is free TEXT, no CHECK enum -- verified directly), so `RESTRUCTURE_CAMPAIGN`
-- needs no change there. `audit_log.action_type`, however, DOES carry a real CHECK enum
-- (045_audit_log.sql, widened once already by 047_creative_packages_auto_loop.sql for
-- `CREATIVE_BRIEF_CREATED`) -- this sprint's own new real writers
-- (`SchedulerService.runAndromedaRestructureCheck` -> `ANDROMEDA_RESTRUCTURE_DETECTED`,
-- `PendingActionsService.approve()`'s new `RESTRUCTURE_CAMPAIGN` branch -> `CAMPAIGN_RESTRUCTURED`
-- for a real, non-simulated result) need that enum widened the SAME real way 047 already did, same
-- `DROP CONSTRAINT` + `ADD CONSTRAINT` idiom.
--
--   ANDROMEDA_RESTRUCTURE_DETECTED -- written once per real detected low-diversity/fragmented
--   campaign (`runAndromedaRestructureCheck`'s own enqueue path), `related_verdict_id` = the real
--   Meta campaign id, `decided_by = 'ai_auto'` (the scheduler detected it, no human decided yet --
--   same real exercise of that CHECK branch `CREATIVE_BRIEF_CREATED` already established).
--
--   CAMPAIGN_RESTRUCTURED -- written once per real, non-simulated LIVE restructure execution
--   (`PendingActionsService.approve()`'s new branch, only when `!restructureResult.simulated`),
--   `related_verdict_id` = the real `pending_agent_actions.id`, `decided_by = 'user_manual'` (a
--   human's real Approve click -- the ONLY way this action_type is ever written; see
--   `PendingActionsService.approve()`'s own doc and `pending-actions.service.spec.ts`'s "SAFETY
--   DEFAULT" test for the explicit proof no scheduler/detection path can ever write this value).
--   `reversible = false` -- same "no safe, honest one-call undo" reasoning `VERDICT_APPLIED`/
--   `BUDGET_CHANGED` already establish for themselves.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `SchedulerService.runAndromedaRestructureCheck`/`PendingActionsService.approve()`'s new
-- `RESTRUCTURE_CAMPAIGN` branch can persist real audit_log rows using these two new values.

ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_type_check CHECK (action_type IN (
  'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
  'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK',
  'CREATIVE_BRIEF_CREATED',
  'ANDROMEDA_RESTRUCTURE_DETECTED', 'CAMPAIGN_RESTRUCTURED'
));
