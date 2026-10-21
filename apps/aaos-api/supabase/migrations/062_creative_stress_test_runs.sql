-- Creative Stress Test, First Boundary -- 062_creative_stress_test_runs.sql. Real next migration
-- number verified directly against this folder's actual latest (061_listing_meta_destination.sql)
-- before choosing 062 -- no other 062 exists.
--
-- NAMING/SCOPE NOTE: this table is deliberately NOT the existing `simulations` table
-- (053/simulation module) -- that table backs a real, unrelated, load-bearing 6-step
-- campaign-creation dry-run wizard whose approval calls GoLiveService to create REAL Meta
-- campaigns. `stress_test_runs` is a brand-new, standalone table for a buyer-persona /
-- objection-mining / creative-critique feature that shares nothing with it beyond the English
-- word "simulation" -- separate table, separate module (`modules/creative-stress-test`), separate
-- routes (`/api/v1/creative-stress-test*`).
--
-- FIRST BOUNDARY SCOPE: this migration persists the run's real input (context/creative selection,
-- persona preset ids, objection source selection, mode, primary goal) and a real, bounded status
-- machine (DRAFT -> QUEUED -> RUNNING -> WAITING_FOR_ENGINE | FAILED | CANCELLED). `result` stays
-- NULL until `execute` is called, then holds only the honest `WAITING_FOR_ENGINE` marker object
-- this boundary's service ever writes -- never a fabricated score/persona verdict/objection list.
-- The actual evaluator registry (buyer persona critic, copy evaluator, scoring/consensus engine,
-- ObjectionMiningService) is Second/Third Boundary and does not exist yet.
BEGIN;

CREATE TABLE public.stress_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('LISTING', 'CAMPAIGN', 'CAMPAIGN_DRAFT', 'CREATIVE_PACKAGE')),
  listing_id uuid,
  campaign_id text,
  campaign_draft_id text,
  creative_ids text[] NOT NULL DEFAULT '{}',
  mode text NOT NULL DEFAULT 'STANDARD' CHECK (mode IN ('FAST', 'STANDARD', 'DEEP')),
  primary_goal text NOT NULL DEFAULT 'CREATIVE_QUALITY'
    CHECK (primary_goal IN ('CPQL', 'HOT_LEAD_RATE', 'CREATIVE_QUALITY', 'MESSAGING_FIT')),
  persona_ids text[] NOT NULL DEFAULT '{}',
  objection_sources text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'QUEUED', 'RUNNING', 'WAITING_FOR_ENGINE', 'FAILED', 'CANCELLED')),
  result jsonb,
  failed_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX stress_test_runs_tenant_created
  ON public.stress_test_runs (tenant_id, created_at DESC);

ALTER TABLE public.stress_test_runs ENABLE ROW LEVEL SECURITY;
-- No anonymous/authenticated direct reads: tenant authorization runs in the API, same discipline
-- as `listing_knowledge_documents`/`ab_tests`.
REVOKE ALL ON public.stress_test_runs FROM anon, authenticated;
GRANT ALL ON public.stress_test_runs TO service_role;

COMMENT ON TABLE public.stress_test_runs IS
  'Creative Stress Test (First Boundary) persisted runs. Separate from `simulations` -- see this file''s header comment for the naming-collision warning.';
COMMENT ON COLUMN public.stress_test_runs.result IS
  'NULL until execute() is called; then the honest WAITING_FOR_ENGINE marker object only -- never a fabricated score/persona verdict. Real evaluator content is Second/Third Boundary.';

COMMIT;
