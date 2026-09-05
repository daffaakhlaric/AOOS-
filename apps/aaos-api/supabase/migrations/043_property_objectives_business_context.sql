-- AAOS LOOP UPGRADE, Sprint 6 Prompt 15 -- Business Context -- 043_property_objectives_business_context.sql
-- Additive extension of `property_objectives` (032_property_objectives.sql) -- the real, already
-- existing table backing PROPERTY's "Objective" settings tab (`PropertyObjectiveService`/
-- `PropertyObjectiveForm.tsx`). The dispatch's own spec named a literal `objective_config` table
-- and `apps/eyvra-dashboard/src/app/property/settings/tabs/ObjectiveTab.tsx` file -- neither exists
-- in this app (confirmed by direct search): there is no `/property/*` route prefix anywhere in this
-- codebase (routes are flat, `/settings?tab=objective`), and the real PROPERTY objective persistence
-- this session already built in an earlier phase IS `property_objectives`
-- (`modules/property-objective`) -- a genuinely separate table from AUTOMOTIVE's in-memory-only
-- `objective-engine` concept (see that migration's own header doc). This migration adds the spec's
-- 3 business-context numbers plus provenance columns to THIS real table, rather than inventing a
-- second, parallel `objective_config` table with no real reader/writer anywhere.
--
-- Real next migration number verified directly against this folder's actual latest
-- (042_creative_packages_ai_recommended.sql) before choosing 043 -- no other 043 exists.
--
-- COLUMNS:
--   avg_deal_value  -- AOV / rata-rata komisi per closing (IDR). Nullable: a tenant that has not
--                    yet filled in business context has none -- NEVER defaulted to a fabricated
--                    number (0 is treated as "not filled in", per `PropertyObjectiveService`'s own
--                    real "isBusinessContextFilled" check -- see that service's doc).
--   target_cpl      -- Target cost-per-HOT-lead (IDR). Nullable, same reasoning.
--   breakeven_cpl   -- Upper bound CPL before a campaign is considered rugi (IDR). Nullable, same
--                    reasoning. Application-level invariant (`UpdateBusinessContextBodySchema`):
--                    when both `target_cpl`/`breakeven_cpl` are provided, `breakeven_cpl` must be
--                    STRICTLY greater than `target_cpl` -- enforced at the Zod boundary (this table
--                    has no shared cross-column CHECK precedent anywhere in this migration folder to
--                    reuse, matching `budget_allocation`'s own "boundary enforcement, not a DB CHECK"
--                    convention already established in `032_property_objectives.sql`).
--   updated_by      -- Real, honest actor for the LAST write to the business-context columns only
--                    (`session.email` forwarded from `apps/eyvra-dashboard`'s route handler, the SAME
--                    "never fabricate an actor" convention `decided_by` uses across
--                    `learning_proposals`/`pending_agent_actions`). Nullable -- an actor with no
--                    resolvable email leaves this `NULL` rather than inventing a value.
--   updated_at      -- Real timestamp of that last business-context write. Nullable until the first
--                    real write; NOT the same column as `created_at` (which reflects the objective
--                    row's own creation, per O1) -- business context can be edited any time after
--                    the objective itself was created.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `PropertyObjectiveService.updateBusinessContext` can persist a real, non-null value.

ALTER TABLE property_objectives
  ADD COLUMN avg_deal_value NUMERIC,
  ADD COLUMN target_cpl     NUMERIC,
  ADD COLUMN breakeven_cpl  NUMERIC,
  ADD COLUMN updated_by     TEXT,
  ADD COLUMN updated_at     TIMESTAMPTZ;
