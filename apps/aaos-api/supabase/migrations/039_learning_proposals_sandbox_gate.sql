-- AAOS-SELF-IMPROVING (Phase SI-5) -- 039_learning_proposals_sandbox_gate.sql
-- Extends `learning_proposals` (024_learning_proposals.sql, extended 035/037) with real, honest
-- signaling for the Phase SI-5 sandbox-informed PROMPT_UPDATE auto-apply gate
-- (`SandboxService.testImprovement`, Phase SI-4 -- now wired into `LearningService.persistProposal`
-- for the one honestly-supported case, SAMANTHA PROMPT_UPDATE(target="analyze")).
--
-- Real next migration number verified directly against this folder's actual latest
-- (038_sandbox_config.sql) before choosing 039 -- no other 039 exists.
--
-- REAL, DELIBERATE DECISION (per this phase's own coordinator instruction, documented here): a
-- `PROMPT_UPDATE` item now ALSO auto-applies at proposal-PERSIST time (the exact same
-- `LearningService.persistProposal` step `CONFIG_UPDATE`/`LOGIC_UPDATE` already auto-apply at, Phase
-- SI-1/SI-2), per the user's own explicit, twice-confirmed "FULL auto-apply for ALL types, no human
-- gate" decision -- UNLESS `SandboxService.testImprovement` returns a real, honest NEGATIVE signal
-- (sandbox score worse than baseline) for that item, in which case the write is deliberately skipped
-- and the item is recorded here instead. When the sandbox is unavailable/degraded (no real
-- historical data, LLM down, run predates the SI-4 context-capture fix, etc.) OR the signal is
-- neutral-or-better, the item auto-applies exactly like a CONFIG_UPDATE/LOGIC_UPDATE item always has
-- -- this phase blocks ONLY on an honest negative signal, never on the mere ABSENCE of one (an
-- absent signal is not evidence of harm -- see `SandboxService`'s own class doc for why sandbox
-- coverage is honestly narrow: SAMANTHA/analyze only, and even there only the `ai_availability`
-- judge dimension can honestly move).
--
-- `LearningDecisionService.approve`'s existing human-gated `PROMPT_UPDATE` path is UNCHANGED and NOT
-- removed -- a human can still force-apply a sandbox-blocked item there (see that service's own
-- updated doc for the real "skip already-applied targets, apply only blocked ones" logic this phase
-- adds to it).
--
--   `sandbox_blocked_items` (JSONB, default '[]') -- the real `PROMPT_UPDATE` items this proposal's
--   persist step tried to auto-apply but a real, negative `SandboxService.testImprovement` result
--   blocked. Each entry is `{ target, agent, result: SandboxTestResult }` -- the REAL sandbox
--   result that caused the block (never a bare flag with no evidence), so a human (or the Learning
--   Monitor UI, Phase SI-6) can see exactly why. Additive, same "never overload the existing
--   auto_applied_config_keys column with a different real meaning" reasoning
--   `035_learning_proposals_auto_applied.sql`'s own header doc already establishes for itself.
--
--   `status` gains ONE new real value, 'AUTO_APPLY_BLOCKED_BY_SANDBOX' -- used ONLY when every
--   improvement item on the proposal is EITHER successfully auto-applied OR honestly
--   sandbox-blocked (no item left needing a bare, unexplained PENDING human review) -- an honest,
--   distinct signal from plain 'PENDING' (which still means "a human has real, undifferentiated work
--   to do here") and from 'AUTO_APPLIED' (which would falsely imply nothing was held back). A human
--   reviewing this status already knows, from `sandbox_blocked_items` on the same row, exactly which
--   items and why -- `LearningDecisionService.approve`/`.reject` both now accept this status as
--   decidable (see that service's own updated doc), same as 'PENDING'.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LearningProposalRepository.markAutoApplied`'s new `sandboxBlockedItems` param and
-- `'AUTO_APPLY_BLOCKED_BY_SANDBOX'` status value can persist a real row.

ALTER TABLE learning_proposals
  ADD COLUMN sandbox_blocked_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE learning_proposals
  DROP CONSTRAINT learning_proposals_status_check;

ALTER TABLE learning_proposals
  ADD CONSTRAINT learning_proposals_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPLIED', 'AUTO_APPLY_BLOCKED_BY_SANDBOX'));
