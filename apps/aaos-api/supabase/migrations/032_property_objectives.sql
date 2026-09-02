-- AAOS PROPERTY Objective (Phase O1 of 2) -- 032_property_objectives.sql
-- Backs the new `modules/property-objective` module, per
-- docs/PROMPT-AAOS-TENANT-SCOPING-AND-PROPERTY-OBJECTIVE.md's "USER DECISIONS #2" and "Phase O1"
-- sections: a genuinely SEPARATE PROPERTY-tenant equivalent of the existing `/objective` feature,
-- NOT a generalization of `packages/objective-engine`'s domain model.
--
-- WHY A SEPARATE TABLE, NOT A REUSE OF `objective-engine`'s OWN CONCEPT (verified directly, not
-- assumed): `objective-engine`'s `AreaPriority` value object requires a valid `@aos/meta-ads-
-- connector` `Branch` enum member, and its `FocusUnit` value object requires one of 10 hardcoded
-- AUTOMOTIVE car model names -- both constructed inside `CreateObjective`'s use case and the
-- `Objective` entity itself, i.e. load-bearing domain validation a PROPERTY tenant's real free-text
-- input (arbitrary city names, arbitrary project/unit names) can never satisfy. AUTOMOTIVE tenants
-- also depend on that exact validation today, so it is not touched here.
--
-- ALSO WORTH NOTING (verified directly against `packages/objective-engine/src/contracts/
-- IObjectiveRepository.ts` and its one real implementation, `InMemoryObjectiveRepository.ts`):
-- `objective-engine`'s own Objective concept has NO Supabase-backed repository at all today --
-- `IObjectiveRepository`'s own header doc states "no DB, no filesystem, per Hard Constraints", and
-- `ObjectiveService`/`ObjectiveModule` (this app's existing `/objective` endpoint) hold their
-- AUTOMOTIVE Objectives entirely in-memory, reset on every process restart. This new
-- `property_objectives` table is therefore NOT a parallel of an existing persisted table -- it is
-- the first REAL persistence either Objective concept gets in this app, deliberately scoped to
-- PROPERTY only, and does not migrate/backfill anything from the in-memory AUTOMOTIVE store.
--
-- `tenant_id` -- free `TEXT`, no FK, same convention every other aaos-api-owned table in this
-- migration folder already establishes (`020_tenant_mode.sql` onward).
--
-- `budget_allocation` -- NUMERIC, always > 0 by the time `PropertyObjectiveService.create` accepts
-- it (see that service's own doc for the real "required, not optional, on the create body" decision
-- and its reasoning). Mirrors the exact same real "0 legitimately allowed at the Value Object level,
-- > 0 enforced at the use-case boundary" pattern `objective-engine`'s own `CreateObjective.ts`
-- documents on its `BudgetAllocation`/Zod schema -- this table has no shared Value Object to permit
-- 0 at, so the boundary enforcement is the ONLY enforcement, and it happens in the service before
-- this table is ever written to; no DB-level CHECK is added beyond `NOT NULL` since the app-level
-- Zod schema (`CreatePropertyObjectiveBodySchema`) already requires `.positive()`.
--
-- `budget_source` -- did the human type this number (`MANUAL`), or accept Samantha's real computed
-- suggestion from `GET /property-objective/budget-suggestion` (`SAMANTHA_SUGGESTED`, whether or not
-- it was then edited before submit)? Real, honest provenance -- never inferred after the fact.
--
-- `focus_listings`/`area_priorities` -- free `TEXT[]`, deliberately NOT coupled to any fixed
-- catalog/enum (unlike AUTOMOTIVE's `FocusUnit`/`AreaPriority`) -- see header doc above.
--
-- `status` -- same real DRAFT/ACTIVE/COMPLETED shape `objective-engine`'s own `ObjectiveStatus`
-- value object already establishes, reused here as a plain string CHECK constraint, NOT a shared
-- import from `objective-engine` -- this table is deliberately independent of that package.
--
-- RLS -- mirrors `024_learning_proposals.sql`'s `manager_view_own_tenant_learning_proposals` policy
-- SHAPE exactly (same `auth.jwt() -> 'user_metadata'` convention). SELECT only: no INSERT/UPDATE
-- policy -- the real writer is `PropertyObjectiveService`/`PropertyObjectiveRepository`, which goes
-- through aaos-api's own service-role Supabase client (the SAME `SUPABASE_CLIENT` every other
-- aaos-api-owned table's writer uses, bypassing RLS entirely), never the anon-key browser client.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `PropertyObjectiveService.create`/`.get` can persist/read a real row.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE property_objectives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,

  period_month      INTEGER NOT NULL,
  period_year       INTEGER NOT NULL,

  target_hot_leads  INTEGER NOT NULL,

  -- Always > 0 at the use-case boundary (`PropertyObjectiveService.create`) -- see this file's
  -- header doc for why no DB-level CHECK duplicates that beyond NOT NULL.
  budget_allocation NUMERIC NOT NULL,

  -- MANUAL: the human typed this number. SAMANTHA_SUGGESTED: the real
  -- GET /property-objective/budget-suggestion computed value was accepted (possibly then edited).
  budget_source     TEXT NOT NULL DEFAULT 'MANUAL'
                      CHECK (budget_source IN ('MANUAL', 'SAMANTHA_SUGGESTED')),

  -- Free text (project/unit names) -- NO fixed catalog, unlike AUTOMOTIVE's FocusUnit.
  focus_listings    TEXT[] NOT NULL,
  -- Free text (city/location names) -- NO Branch enum coupling, unlike AUTOMOTIVE's AreaPriority.
  area_priorities   TEXT[] NOT NULL,

  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_property_objectives_tenant            ON property_objectives(tenant_id);
-- Backs `PropertyObjectiveService`'s "max 1 active/draft objective per tenant per period" check --
-- same real purpose `CreateObjective.countActiveForPeriod` serves for the in-memory AUTOMOTIVE store.
CREATE INDEX idx_property_objectives_tenant_status      ON property_objectives(tenant_id, status);
CREATE INDEX idx_property_objectives_tenant_period      ON property_objectives(tenant_id, period_year, period_month);

-- RLS -- SELECT-only, mirrors `024_learning_proposals.sql`'s real policy shape exactly (see this
-- file's header doc for the reasoning: no INSERT/UPDATE policy, writer goes through aaos-api's
-- service-role client which bypasses RLS entirely).
ALTER TABLE property_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_view_own_tenant_property_objectives" ON property_objectives
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('manager', 'owner')
    AND tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenantId')
  );
