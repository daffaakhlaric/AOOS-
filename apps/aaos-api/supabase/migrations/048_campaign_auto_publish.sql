-- AAOS LOOP UPGRADE, Sprint 8c -- Samantha builds/publishes a real campaign from a freshly
-- Kai/Kie-AI-generated asset, with a real budget-increase guardrail + loop-run summary
-- (Prompt 19, Steps 5-6) -- 048_campaign_auto_publish.sql
--
-- Real next migration number verified directly against this folder's actual latest
-- (047_creative_packages_auto_loop.sql) before choosing 048 -- no other 048 exists.
--
-- ================================================================================================
-- PART 1 -- `property_objectives` (032/043/047) additive columns -- the 2 real, explicitly
-- user-confirmed safety-critical settings this dispatch's own coordinator note names.
-- ================================================================================================
--
-- Same real, already-established per-tenant PROPERTY automation-settings home 047 already extended
-- for `max_auto_briefs_per_day`/`auto_approve_creative_brief` -- reused here rather than a 3rd
-- competing table, for the exact same reasoning 047's own header doc already gives (including the
-- same honest monthly-period caveat: a tenant with no current-period objective row still gets the
-- safe DB default via `PropertyObjectiveService.getAutoPublishSettingsSafe`, mirroring
-- `getAutoLoopSettingsSafe` exactly).
--
-- `auto_publish_campaign` -- BOOLEAN, default FALSE. THE single most important default in this
-- migration (user explicitly confirmed before this dispatch was authorized, matching the spec's own
-- stated safety default) -- see `campaign-publish-guardrail.spec.ts`'s real, explicit
-- "SAFETY DEFAULT" test proving `auto_publish_campaign = false` never results in an unattended real
-- Meta publish call, mirroring `creative-brief-guardrail.spec.ts`'s own precedent test exactly.
--
-- `max_budget_increase_pct` -- INTEGER, default 20 (percent). User explicitly deferred this number
-- to the agent's judgment; the spec's own literal text already suggests 20% ("max_budget_increase_pct
-- per hari (setting, default 20%)"). Applies REGARDLESS of `auto_publish_campaign`'s value -- see
-- `decideCampaignPublishGuardrail`'s own doc for the full real guardrail chain, and
-- `campaign-publish-guardrail.spec.ts`'s explicit "guardrail actually BLOCKS, not just warns" test.
ALTER TABLE property_objectives
  ADD COLUMN auto_publish_campaign BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN max_budget_increase_pct INTEGER NOT NULL DEFAULT 20;

-- ================================================================================================
-- PART 2 -- `creative_packages` (003/026/042/044/047) -- real idempotency marker for Step 5's
-- "asset GENERATED -> campaign build/publish" trigger.
-- ================================================================================================
--
-- HONEST DEVIATION from the spec's literal trigger wording ("ada asset GENERATED"): this app's real
-- `CreativePackageStatus` enum (`creative-package.ts`) has no `GENERATED` value -- a successfully
-- completed generation lands on `PENDING` ("generated, awaiting review", see that file's own status
-- doc). This migration/its real callers therefore treat `status = 'PENDING'` (`source = 'auto_loop'`,
-- `related_verdict_id` set) as the honest analog of the spec's "GENERATED" -- documented here rather
-- than silently renamed.
--
-- `campaign_publish_status` -- nullable TEXT, no default (NULL = not yet considered by Step 5's real
-- campaign-publish check). Needed because `SchedulerService.runPropertyCampaignTriggerCheck` runs
-- every loop tick (SAMANTHA_ANALYZE / KAI_REFRESH_CHECK) -- without a real, persisted "already
-- considered" marker, the SAME freshly-generated asset would be re-evaluated (and, if allowed,
-- re-published as a SECOND campaign) on every subsequent tick. Real values: `PUBLISHED` (a real
-- `createPropertyCampaign` call was made for this asset -- DEV-simulated or real LIVE, both count as
-- "considered, no need to re-trigger") | `PENDING_REVIEW` (guardrail decided a human must approve --
-- `pending_agent_actions` row enqueued) | `SKIPPED` (best-effort failure path, logged and never
-- retried automatically -- see `SchedulerService.runCampaignPublishCheck`'s own doc for why silent
-- infinite-retry is worse than a one-time honest skip a human can still act on via the Creative Hub).
ALTER TABLE creative_packages
  ADD COLUMN campaign_publish_status TEXT
    CHECK (campaign_publish_status IN ('PUBLISHED', 'PENDING_REVIEW', 'SKIPPED'));

CREATE INDEX idx_creative_packages_campaign_publish_pending
  ON creative_packages(tenant_id, source, status, campaign_publish_status)
  WHERE source = 'auto_loop' AND status = 'PENDING' AND campaign_publish_status IS NULL;

-- ================================================================================================
-- PART 3 -- `loop_runs` -- real Step 6 summary row, one per real loop cycle
-- (`SchedulerService.runPropertyCampaignTriggerCheck`'s own real per-cycle boundary).
-- ================================================================================================
--
-- `id` is deliberately the SAME real `correlationId` `SchedulerService` already generates once per
-- `executeEvent` call (`randomUUID()`) and threads through as `agent_activities.loop_id` on every
-- real activity row this cycle writes -- so `loop_runs.id = agent_activities.loop_id` for the same
-- cycle, letting a real join enrich the existing "Loop Run" group header
-- (`ActivityHubClient.tsx`'s own real grouping, confirmed by direct investigation to already derive
-- from `agent_activities.loop_id` -- this table is genuinely NEW, additive summary data, not a
-- replacement for that existing grouping mechanism).
CREATE TABLE loop_runs (
  id                            UUID PRIMARY KEY,
  tenant_id                     TEXT NOT NULL,
  started_at                    TIMESTAMPTZ NOT NULL,
  completed_at                  TIMESTAMPTZ NOT NULL,
  duration_ms                   INTEGER NOT NULL,
  -- Real per-ad verdict count observed this cycle (PAUSE + SCALE, the same real classification
  -- `runSamanthaAnalyze` already computes) -- 0 for a cycle triggered from `runKaiRefreshCheck`
  -- alone (an honest, real count of ads evaluated for a REFRESH decision there instead -- see
  -- `SchedulerService`'s own call-site comments for exactly which real number each caller passes).
  total_verdicts                INTEGER NOT NULL DEFAULT 0,
  total_briefs_auto_generated   INTEGER NOT NULL DEFAULT 0,
  total_assets_generated        INTEGER NOT NULL DEFAULT 0,
  total_campaigns_published     INTEGER NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loop_runs_tenant_created ON loop_runs(tenant_id, created_at DESC);

ALTER TABLE loop_runs ENABLE ROW LEVEL SECURITY;

-- Mirrors `audit_log`'s own real manager-read RLS policy shape exactly (045's own verified
-- convention: `auth.jwt() -> 'user_metadata' ->> 'tenantId'` + role check) -- same convention this
-- whole migration folder already establishes for every tenant-scoped table.
CREATE POLICY "manager_view_own_tenant_loop_runs" ON loop_runs
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );

-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `SchedulerService.runCampaignPublishCheck`/`PendingActionsService`'s new
-- `PUBLISH_CAMPAIGN_FROM_ASSET` branch/`loop_runs` writer can persist/read real rows using these
-- columns/table.
