-- AAOS-SELF-IMPROVING (Phase SI-6, final) -- 040_learning_proposals_accuracy_check.sql
-- Extends `learning_proposals` (024_learning_proposals.sql, extended 030/035/037/039) with real,
-- honest storage for the Phase SI-6 weekly real-world accuracy-check cron
-- (`AccuracyCheckService.runWeeklyAccuracyCheck`).
--
-- Real next migration number verified directly against this folder's actual latest
-- (039_learning_proposals_sandbox_gate.sql) before choosing 040 -- no other 040 exists.
--
-- REAL, DELIBERATE DECISION (documented here, per this phase's own coordinator instruction): the
-- accuracy check compares real `judge_results.scores.overall` averages for the SAME real
-- tenant+agent, partitioned by whether each row's `created_at` is BEFORE or AFTER this proposal's
-- own `created_at` (the moment it was auto-applied / sandbox-blocked) -- never a fabricated score.
-- These are ADDITIVE, NULLABLE columns on the existing table -- never a destructive change, and
-- every column starts NULL for every existing row (an honest "not checked yet", the correct state
-- until `AccuracyCheckService`'s weekly cron actually runs against it).
--
-- `accuracy_verdict` is deliberately a SEPARATE, additive column from `status` -- never overloads
-- the existing PENDING/APPROVED/REJECTED/AUTO_APPLIED/AUTO_APPLY_BLOCKED_BY_SANDBOX status enum
-- (same "why a new column, not overloading status" reasoning `035_learning_proposals_auto_applied.
-- sql`'s own header doc already establishes for `auto_applied_config_keys`). Real values:
--   'IMPROVED'     -- real, sufficient before/after sample sizes, and the after-average is a real,
--                     meaningfully higher score than the before-average (see
--                     `AccuracyCheckService`'s own class doc for the exact, config-backed
--                     threshold).
--   'REGRESSED'    -- same real sufficiency bar, but the after-average is meaningfully LOWER.
--                     `AccuracyCheckService` does NOT auto-revert on this verdict -- see that
--                     class's own doc for why a REGRESSED verdict is a real, honest, PASSIVE flag
--                     (a human/future action, e.g. `LearningDecisionService.rollback`, is still
--                     required to actually revert) rather than a forced real
--                     `ROLLED_BACK` mechanism.
--   'INCONCLUSIVE' -- the real, honest degrade: either side of the before/after partition has
--                     fewer than `AccuracyCheckService.MIN_SAMPLE_SIZE` real `judge_results` rows,
--                     OR both sides have enough data but the real delta between them falls inside
--                     the configured "not a meaningful difference" band -- NEVER a fabricated
--                     verdict standing in for "we don't know yet".
-- `accuracy_reason` is a short, real, human-readable free-text explanation of exactly which of the
-- above applied (sample sizes, real delta, real threshold) -- same "never a bare flag with no
-- evidence" discipline `039_learning_proposals_sandbox_gate.sql`'s own `sandbox_blocked_items`
-- column already establishes.
--
-- `accuracy_score_before`/`accuracy_score_after` -- the real, computed averages that produced the
-- verdict (NULL when the corresponding sample size was 0). `accuracy_sample_before`/
-- `accuracy_sample_after` -- the real COUNT of `judge_results` rows each average was computed over
-- (always real integers, `0` is a valid, honest value -- never NULL once a check has actually run).
-- `accuracy_checked_at` -- when this row was last real-checked; NULL until the first real cron run
-- reaches it. A proposal whose verdict is `NULL` or `'INCONCLUSIVE'` is re-checked on every
-- subsequent real weekly run (see `AccuracyCheckService`'s own doc) -- `accuracy_checked_at` always
-- reflects the MOST RECENT real check, even if the verdict itself didn't change.

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_verdict TEXT NULL
    CHECK (accuracy_verdict IS NULL OR accuracy_verdict IN ('IMPROVED', 'REGRESSED', 'INCONCLUSIVE'));

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_reason TEXT NULL;

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_score_before NUMERIC NULL;

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_score_after NUMERIC NULL;

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_sample_before INTEGER NULL;

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_sample_after INTEGER NULL;

ALTER TABLE learning_proposals
  ADD COLUMN accuracy_checked_at TIMESTAMPTZ NULL;

-- Real read pattern this index serves: `AccuracyCheckService.runWeeklyAccuracyCheck`'s own
-- `LearningProposalRepository.listNeedingAccuracyCheck` query -- proposals whose `status` is
-- AUTO_APPLIED/AUTO_APPLY_BLOCKED_BY_SANDBOX and whose `accuracy_verdict` is NULL or INCONCLUSIVE,
-- ordered by `created_at`. A partial index (only rows with a real "genuinely applied" status) keeps
-- this small and fast even as `learning_proposals` grows, mirroring `034_agent_configs.sql`'s own
-- targeted-index precedent.
CREATE INDEX idx_learning_proposals_accuracy_pending
  ON learning_proposals (created_at)
  WHERE status IN ('AUTO_APPLIED', 'AUTO_APPLY_BLOCKED_BY_SANDBOX')
    AND (accuracy_verdict IS NULL OR accuracy_verdict = 'INCONCLUSIVE');
