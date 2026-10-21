-- Creative Stress Test, Second Boundary -- 063_creative_stress_test_runs_completed_status.sql.
-- Real next migration number verified directly against this folder's actual latest
-- (062_creative_stress_test_runs.sql) before choosing 063 -- no other 063 exists.
--
-- First Boundary's `stress_test_runs.status` CHECK constraint only allowed
-- ('DRAFT','QUEUED','RUNNING','WAITING_FOR_ENGINE','FAILED','CANCELLED') -- `WAITING_FOR_ENGINE`
-- was the honest terminal state used because no evaluator engine existed yet. Second Boundary
-- ships a real evaluator registry (buyer persona simulation, copy evaluator, fact/claim validator,
-- scoring aggregation -- see `modules/creative-stress-test/creative-stress-test.service.ts`), so a
-- run that actually finishes evaluation now needs a genuinely new terminal status: `COMPLETED`.
--
-- `WAITING_FOR_ENGINE` is NOT removed from the allowed list: it stays reachable as the honest
-- degrade when a run's `execute()` produces zero successful evaluator results (see that method's
-- own "full failure" doc) is instead represented by `FAILED` with a real `failed_reason` -- but
-- `WAITING_FOR_ENGINE` is kept in the CHECK constraint for backward compatibility with any row
-- already persisted in that state and to avoid a data migration of historical rows.
--
-- `result`'s column stays untouched -- it was already a flexible `jsonb` column (062's own
-- comment), so the new real per-persona/copy/fact-check/scoring result shape needs no migration.
BEGIN;

ALTER TABLE public.stress_test_runs DROP CONSTRAINT stress_test_runs_status_check;
ALTER TABLE public.stress_test_runs ADD CONSTRAINT stress_test_runs_status_check
  CHECK (status IN ('DRAFT', 'QUEUED', 'RUNNING', 'WAITING_FOR_ENGINE', 'COMPLETED', 'FAILED', 'CANCELLED'));

COMMENT ON COLUMN public.stress_test_runs.result IS
  'NULL until execute() is called. Second Boundary: a real evaluator result object (per-persona simulated critiques, copy evaluation, fact-check findings, dimension scores, overall score, confidence) when status = COMPLETED; the honest WAITING_FOR_ENGINE marker is now legacy-only (kept for backward compatibility with any row already in that state).';

COMMIT;
