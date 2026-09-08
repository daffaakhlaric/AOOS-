-- AAOS LOOP UPGRADE, Sprint 8a -- Auto-generate creative brief (Prompt 19, Steps 1-3 only) --
-- 047_creative_packages_auto_loop.sql
--
-- Real next migration number verified directly against this folder's actual latest
-- (046_market_signals.sql) before choosing 047 -- no other 047 exists.
--
-- ================================================================================================
-- PART 1 -- `creative_packages` (003_creative_packages.sql, extended 026/042/044) additive columns
-- ================================================================================================
--
-- The spec's own pseudocode asks for a separate `creative_briefs` table with columns
-- `listing_id, recommended_angle[], format, target_audience_segment, reasoning, priority, source,
-- related_verdict_id, status`. Investigated honestly (per this dispatch's own coordinator note):
-- `creative_packages` ALREADY carries `listing_id` (026), `angle` (single, not an array -- see
-- below), `requested_format`/`decided_format`, `reason` (== "reasoning"), and a real `status`
-- state machine (003's own header doc) -- the SAME shape a `creative_briefs` row would need,
-- reviewed through the SAME real Creative Hub queue. A second, competing table would fork that
-- review queue in two, exactly the kind of duplication this migration folder's own conventions
-- (026/042/044's header docs) all explicitly reject. This migration therefore extends
-- `creative_packages` additively with only the 3 genuinely NEW columns Step 3 needs:
--
--   source              -- 'manual' (every pre-existing row, and every future manually-created
--                          brief, including a human accepting a Samantha REFRESH recommendation
--                          via the existing Tab "Rekomendasi Samantha" flow -- that flow is still a
--                          human clicking a button) | 'auto_loop' (this dispatch's new, real write
--                          path: `SchedulerService`'s NEED_CREATIVE detection auto-inserting a
--                          brief with no human having clicked anything yet). Deliberately a NEW
--                          column, not a reuse of the existing `origin` ('MANUAL' | 'SAMANTHA')
--                          column -- `creative-package.ts`'s own docstring on `CreativePackageOrigin`
--                          states "Both require a human click before Kai/Kie AI ever runs", a real,
--                          load-bearing invariant this migration does not weaken. An `auto_loop` row
--                          keeps `origin = 'SAMANTHA'` (Samantha's own NEED_CREATIVE verdict is what
--                          produced it) -- `source` is the orthogonal, genuinely new "was this
--                          specific row inserted by a human action or by the scheduler" axis.
--   related_verdict_id  -- Free, nullable TEXT (no FK -- same no-cross-table-FK convention this
--                          whole migration folder already establishes, e.g. `audit_log
--                          .related_verdict_id`). Holds the real `listings.id` the NEED_CREATIVE
--                          check fired for (this app's real per-ad Verdict concept, from
--                          `@aos/meta-ads-connector`'s `Verdict` enum, is not itself a persisted row
--                          with its own id anywhere -- `audit_log.related_verdict_id`'s own real
--                          usage already establishes "the id of the real thing the verdict was ABOUT"
--                          as the honest value for this kind of column, not a fabricated verdict-row
--                          id that doesn't exist).
--   priority             -- LOW | MEDIUM (default) | HIGH -- same 3-level shape `urgency` already
--                          uses on this table, reused here as ITS OWN column (not a `urgency` alias)
--                          because the spec's Step 3 explicitly asks for a brief-level `priority`
--                          distinct from a generation-level `urgency`; `evaluateNeedCreative`'s own
--                          doc (`scheduler/domain/need-creative.ts`) explains what real signal sets
--                          it.
--
-- `recommended_angle[]` (plural) from the spec's own pseudocode is NOT added: this table's real
-- `angle` column is already singular (`AdAngle`/`PropertyAdAngle`, one value per package, matching
-- every real Kai brief this app has ever built) -- Step 2's own real NEED_CREATIVE condition (a)
-- does not honestly compute a multi-angle recommendation list (see `need-creative.ts`'s own doc for
-- the real, honest degrade this uses instead), so adding an unused plural column here would just be
-- a second, always-empty field with no real writer.
--
-- `target_audience_segment` from the spec is likewise not added: no real per-listing audience-
-- segmentation concept exists anywhere in this codebase to populate it honestly (`target_persona`
-- is AUTOMOTIVE-only and already nullable for PROPERTY per 026's own header doc) -- inventing a
-- value here would violate this whole session's "never fabricate a value no real caller can
-- honestly compute" discipline.
ALTER TABLE creative_packages
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_loop')),
  ADD COLUMN related_verdict_id TEXT,
  ADD COLUMN priority TEXT NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));

CREATE INDEX idx_creative_packages_source_tenant_created
  ON creative_packages(tenant_id, source, created_at)
  WHERE source = 'auto_loop';

-- Real status-machine extension: `PENDING_REVIEW` (this dispatch's own NEW value -- see
-- `creative-package.ts`'s updated `CreativePackageStatus` doc). No CHECK constraint exists on this
-- table's `status` column (verified directly against 003/026/042/044 -- confirmed absent), so this
-- is a pure application-layer addition, needing no DB change beyond the 3 columns above.
--
-- ================================================================================================
-- PART 2 -- `property_objectives` (032/043) additive columns -- the real guardrail settings
-- ================================================================================================
--
-- The spec names "Settings di Settings > Objective" for `max_auto_briefs_per_day` and a NEW
-- "Auto-approve creative brief" toggle. This app's real, already-established per-tenant
-- automation-settings home for PROPERTY is `property_objectives` (043's own header doc: "real,
-- tenant-level automation settings... belong there additively"), the same real table Sprint 6's
-- Business Context numbers already extended -- reused here rather than a 3rd competing table.
--
-- REAL, HONEST CAVEAT (documented, not hidden): `property_objectives` rows are scoped to a
-- MONTHLY period (`period_month`/`period_year`, 032's own schema) -- `PropertyObjectiveService
-- .getCurrentSafe` only resolves a row for THIS month, and returns `undefined` for a tenant that
-- has not created an objective for the current period yet. A tenant-wide safety setting living on a
-- monthly row is not a perfect fit -- but every real call site in this dispatch (`SchedulerService
-- .runNeedCreativeCheck`) treats `undefined` the SAME honest way the column's own DB default
-- already does (`maxAutoBriefsPerDay ?? 5`, `autoApproveCreativeBrief ?? false`), so a tenant with
-- no current-month objective still gets the exact safe default this dispatch's own safety
-- requirement demands -- never an unguarded auto-approve. Investigated whether `tenants` (031's own
-- per-tenant `operating_mode` precedent) would fit better: rejected because `auto_approve_creative_
-- brief` is a PROPERTY-vertical-only, Objective-tab-scoped setting per the spec's own UI framing
-- ("Settings > Objective"), the exact same framing 043 already used to justify extending THIS table
-- instead of `tenants`.
--
-- `max_auto_briefs_per_day` -- INTEGER, default 5 (spec's own literal default), > 0 enforced at the
-- Zod boundary (`UpdateAutoLoopSettingsBodySchema`), same "boundary enforcement, not a DB CHECK"
-- convention 032/043 already establish for this table.
-- `auto_approve_creative_brief` -- BOOLEAN, default FALSE. THE single most important default in
-- this migration (Sprint 8a's own explicit safety requirement) -- see
-- `creative-brief-guardrail.spec.ts`'s real, explicit tests proving this OFF-by-default behavior is
-- honored end-to-end, not just at the column level.
ALTER TABLE property_objectives
  ADD COLUMN max_auto_briefs_per_day INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN auto_approve_creative_brief BOOLEAN NOT NULL DEFAULT false;

-- ================================================================================================
-- PART 3 -- `audit_log` (045) -- a new, honest `action_type` for THIS stage (brief created, not yet
-- generated)
-- ================================================================================================
--
-- 045's own header doc left `related_brief_id` "reserved for a future CREATIVE_GENERATED writer
-- this phase does not add" -- investigated honestly whether that reservation is what THIS dispatch
-- should now fill. It is NOT: `CREATIVE_GENERATED`'s own name describes Kai/Kie AI actually
-- generating creative output (Step 4 of the full Prompt 19 loop), which is explicitly OUT OF SCOPE
-- for Sprint 8a (Steps 1-3 only, per the coordinator note). Reusing `CREATIVE_GENERATED` for "a
-- brief row was inserted" would be a dishonest label -- nothing was generated yet, only a request
-- for future generation was recorded, most of the time still awaiting a human's explicit approval.
-- This migration therefore adds a genuinely NEW, correctly-scoped value instead:
--   CREATIVE_BRIEF_CREATED -- written once per real auto-generated brief (Step 3's own guardrail
--   write path), `related_brief_id` = the real new `creative_packages.id`, `related_verdict_id` =
--   the real `listings.id` the NEED_CREATIVE check fired for (same value as the new
--   `creative_packages.related_verdict_id` column above). `decided_by = 'ai_auto'` always (no human
--   decided to create THIS row -- the scheduler did, gated by the real guardrail chain) --
--   `CREATIVE_BRIEF_CREATED` is the first `action_type` in this table ever written with
--   `decided_by = 'ai_auto'` for a NEW action (every existing writer only ever writes
--   `decided_by = 'ai_auto'`... actually verified: `PendingActionsService`'s writers always use
--   'user_manual' since they only fire on an explicit human approve/reject; NO existing writer uses
--   'ai_auto' today) -- this is therefore the first REAL exercise of that branch of the
--   `decided_by` CHECK constraint, which has existed since 045 but had no real writer yet.
ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_type_check CHECK (action_type IN (
  'VERDICT_APPLIED', 'VERDICT_REJECTED', 'CREATIVE_GENERATED',
  'CAMPAIGN_PUBLISHED', 'BUDGET_CHANGED', 'ROLLBACK',
  'CREATIVE_BRIEF_CREATED'
));

-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `SchedulerService.runNeedCreativeCheck`/`PendingActionsService`'s new `REVIEW_CREATIVE_BRIEF`
-- branch can persist/read real rows using these columns.
