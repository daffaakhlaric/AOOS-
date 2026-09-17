-- EYVRA -- SAMANTHA V2, Phase 1 Part A -- 054_growth_objectives.sql
--
-- REAL GAP THIS CLOSES: SAMANTHA V2's "Growth Objective" (a tenant's business goal --
-- "get N Hot Leads by date X, within budget Y") has no persisted home anywhere in this codebase
-- today. This migration adds the two tables Phase 1 Part A's `modules/growth-objectives` and
-- `modules/hot-lead-definitions` need. Reverse Funnel / Feasibility / Metric Snapshot / Signal
-- Engine (the machinery that actually PLANS and TRACKS an objective) are explicitly out of scope
-- for this migration -- see `growth_objectives.status`'s CHECK list below, which already reserves
-- the later-phase states so this table never needs another migration just to add a status value.
--
-- (a) WHY `growth_objectives.metric` ONLY allows 'HOT_LEADS' today: the raw SAMANTHA V2 spec this
-- phase is based on imagines a tenant picking from several metrics (hot leads, qualified leads,
-- appointments, surveys, bookings). None of those other concepts are real, queryable data in this
-- codebase's CRM model -- `packages/lead-store/src/domain/entities/Lead.ts` has no "qualified"
-- stage, and there is no appointment/survey/booking table anywhere in `aaos-api`. Per this
-- session's explicit user decision ("CRM belakangan" -- CRM overhaul comes later), this phase does
-- NOT invent new CRM stages just to make the other metrics selectable. The only metric a tenant can
-- honestly track today is `HOT_LEADS`, derived from real `Lead.status`/`Lead.score`/
-- `Lead.qualification` via `hot_lead_definitions` below. The CHECK constraint is intentionally
-- narrow (not a free TEXT column) so a future metric requires a real migration alongside the real
-- CRM/data-model work that makes it queryable -- never a silently-fake dropdown option.
--
-- (b) WHY `hot_lead_definitions.rules` is restricted (in APPLICATION code -- Zod, not a DB CHECK,
-- since JSONB can't express a field-name allowlist declaratively) to real `Lead.qualification` keys
-- (`budget`,`unit`,`area`,`payment`,`timeline`,`name`) plus `score`/`status`, instead of the raw
-- spec's aspirational rule fields (`buying_timeline_days`, `reachable`, `area_match`,
-- `budget_match`): none of those fields exist on the real `Lead` entity
-- (`packages/lead-store/src/domain/entities/Lead.ts`, read column-for-column before writing this
-- migration) -- there is no numeric "days until buying", no "reachable" flag, no fuzzy
-- area/budget-match score, only the 6 boolean `LeadQualificationFlags` plus `score`/`status`. A
-- rule referencing a fictional field would silently evaluate to "never true" (or worse, throw at
-- runtime) with nothing in the schema to catch it at write time -- so `modules/hot-lead-definitions`'
-- Zod schema enumerates only the fields `domain/evaluate-hot-lead.ts` can actually evaluate against
-- a real `Lead`.
--
-- Both tables follow `031_operating_mode.sql`'s TEXT-`tenant_id`-no-FK convention (every other
-- genuinely-new-from-Phase-1-onward table in this app already does this -- `tenant_id` is never a
-- real FK to a `tenants.id` column in this schema).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `modules/growth-objectives`/`modules/hot-lead-definitions` can read/write real data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- `growth_objectives` -- one row per tenant business goal. Multiple objectives per tenant are
-- allowed (no UNIQUE(tenant_id) -- a tenant may run more than one goal, e.g. sequential campaigns),
-- unlike `hot_lead_definitions` below (one definition per tenant, by design).
CREATE TABLE growth_objectives (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL,

  -- See header doc (a) -- only 'HOT_LEADS' is real, queryable data today.
  metric            TEXT NOT NULL CHECK (metric IN ('HOT_LEADS')),
  target_value      INTEGER NOT NULL CHECK (target_value > 0),

  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,

  budget_mode       TEXT NOT NULL CHECK (budget_mode IN ('GOAL_FIRST', 'BUDGET_FIRST', 'BALANCED')),
  max_budget_idr    BIGINT,

  -- References real `listings.id`s -- no FK array constraint (Postgres has no native
  -- `UUID[] REFERENCES`), so referential integrity here is application-enforced
  -- (`GrowthObjectivesService`/callers must validate each id against `ListingsService` themselves,
  -- same "no FK, app validates" discipline `020_tenant_mode.sql`'s family of tables already
  -- establishes for free-TEXT `tenant_id`).
  focus_listing_ids UUID[] NOT NULL DEFAULT '{}',

  area_strategy     TEXT NOT NULL CHECK (area_strategy IN ('SAMANTHA', 'MANUAL')),
  manual_areas      TEXT[] NOT NULL DEFAULT '{}',

  automation_mode   TEXT NOT NULL CHECK (
                      automation_mode IN ('ADVISOR', 'COPILOT', 'AUTOPILOT_GUARDED', 'AUTONOMOUS')
                    ),

  -- Full lifecycle CHECK list, including states no Phase 1 Part A code path can reach yet
  -- (ANALYZING/PLANNED/ON_TRACK/AT_RISK/OFF_TRACK/REPLANNING/COMPLETED depend on the Reverse
  -- Funnel/Feasibility/Signal Engine work this phase explicitly defers) -- reserved now so a later
  -- phase never needs a migration just to widen this CHECK. `GrowthObjectivesService` in this phase
  -- only ever writes 'DRAFT' (on create) and reads/validates the 'PLANNED' -> 'ACTIVE' transition
  -- (`activate`) as a documented placeholder -- see that service's own doc.
  status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
                      status IN (
                        'DRAFT', 'ANALYZING', 'PLANNED', 'ACTIVE', 'ON_TRACK', 'AT_RISK',
                        'OFF_TRACK', 'REPLANNING', 'COMPLETED', 'PAUSED'
                      )
                    ),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT growth_objectives_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_growth_objectives_tenant_status ON growth_objectives(tenant_id, status);

-- `hot_lead_definitions` -- one row per tenant, their own choice of how "Hot Lead" is defined for
-- Growth Objective purposes. Deliberately separate from `growth_objectives` (not a column on it):
-- the spec's own instruction is that a tenant defines this ONCE at the tenant level, reused across
-- every objective, and the UI must ask the tenant to define it explicitly rather than any endpoint
-- silently defaulting it (see `modules/hot-lead-definitions/hot-lead-definitions.service.ts`'s
-- `get()` doc for how that "no silent default" rule is enforced in application code).
CREATE TABLE hot_lead_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         TEXT NOT NULL UNIQUE,

  mode              TEXT NOT NULL CHECK (mode IN ('LEAD_STATUS', 'RULE_BASED')),

  -- Populated when mode = 'LEAD_STATUS'. Stored explicitly (not hardcoded to 'HOT' in application
  -- code) so a tenant can choose 'WARM' to count as hot too -- validated against the real
  -- `LeadStatus` enum (`packages/lead-store/src/domain/value-objects/LeadStatus.ts`) in
  -- `modules/hot-lead-definitions`' Zod schema, not by a DB CHECK (keeping the enum's single
  -- source of truth in the TypeScript package, same reasoning `021_agent_activities.sql`'s family
  -- gives for leaving analogous free-TEXT columns un-CHECKed against a TS-owned enum).
  lead_status_value TEXT,

  -- Populated when mode = 'RULE_BASED' -- an array of `{field, operator, value}` objects. See
  -- header doc (b) for why `field`'s vocabulary is restricted (in application code) to real
  -- `Lead.qualification` keys plus `score`/`status`.
  rules             JSONB,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
