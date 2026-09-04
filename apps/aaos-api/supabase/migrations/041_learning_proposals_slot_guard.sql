-- AAOS SELF-IMPROVING -- real production-incident fix -- 041_learning_proposals_slot_guard.sql
-- Extends `learning_proposals` (024_learning_proposals.sql, extended 030/035/037/039/040) with real,
-- honest storage for the new `PromptSlotGuardService` integrity check
-- (`apps/aaos-api/src/modules/prompt-override/prompt-slot-guard.service.ts`), wired into
-- `LearningService.persistProposal` immediately before EVERY `PROMPT_UPDATE` auto-apply.
--
-- Real next migration number verified directly against this folder's actual latest
-- (040_learning_proposals_accuracy_check.sql) before choosing 041 -- no other 041 exists.
--
-- REAL PRODUCTION INCIDENT THIS FIXES (see `PromptSlotGuardService`'s own class doc for the full
-- writeup): `SandboxService.testImprovement` is honestly scoped to ONLY
-- `SAMANTHA PROMPT_UPDATE(target="analyze")` -- every CLARA `PROMPT_UPDATE` proposal sailed straight
-- through `LearningService.persistProposal`'s "an absent signal never blocks" policy with ZERO real
-- gate. Confirmed directly against the live production DB: tenant `agen-pintar-indonesia`'s
-- `clara_system_prompt` override reached version 14 within hours, its content degraded to a single
-- generic sentence with ZERO of the real `{branch}`/`{score}`/`{stage}`/`{lead_profile}`/
-- `{available_units}`/`{stage_instruction}` slots `buildSystemPrompt` requires (that function REPLACES
-- the whole template with an override, never appends -- see `buildClaraPrompt.ts`'s own doc).
--
-- REAL, DELIBERATE DECISION (matching this whole effort's own "never overload an existing column with
-- a different real meaning" discipline, `035_learning_proposals_auto_applied.sql`'s own header doc):
--
--   `slot_guard_blocked_items` (JSONB, default '[]') -- the real `PROMPT_UPDATE` items this proposal's
--   persist step tried to auto-apply but `PromptSlotGuardService.check` found missing one or more real
--   `{slot}` placeholders the current active override (or, absent one, the base template) requires.
--   Each entry is `{ agent, target, missingSlots, requiredSlots }` -- the REAL slot lists that caused
--   the block (never a bare flag with no evidence), same "why a real evidence payload, not just a
--   flag" reasoning `039_learning_proposals_sandbox_gate.sql`'s own `sandbox_blocked_items` column
--   already establishes. Deliberately a SEPARATE, additive column from `sandbox_blocked_items` --
--   these are two genuinely different real checks (slot-integrity vs. sandbox-judged-score-delta) with
--   two genuinely different real evidence shapes; reusing `sandbox_blocked_items` for both would blur
--   which real check actually blocked a given item.
--
--   `status` gains ONE new real value, 'AUTO_APPLY_BLOCKED_MISSING_SLOTS' -- used when every
--   improvement item on the proposal is EITHER successfully auto-applied, honestly sandbox-blocked, OR
--   honestly slot-guard-blocked (no item left needing a bare, unexplained PENDING human review) AND at
--   least one item was slot-guard-blocked -- an honest, distinct signal, same "distinct status per real
--   block reason" precedent `AUTO_APPLY_BLOCKED_BY_SANDBOX` already establishes. `status` priority
--   (`LearningService.persistProposal`'s own doc has the full reasoning): a genuine write/parse
--   failure always wins (-> 'PENDING'); otherwise a slot-guard block wins over a sandbox block (a
--   missing-slot proposal is a structural integrity problem checked FIRST, before the sandbox's own
--   real LLM re-run is even attempted, so it is the more fundamental of the two real reasons a
--   proposal on this row was held back). `LearningDecisionService.approve`/`.reject` both now accept
--   this status as decidable, same as `PENDING`/`AUTO_APPLY_BLOCKED_BY_SANDBOX` -- a human can still
--   force a slot-guard-blocked item through `approve()`, this is NOT a new human-approval GATE, only a
--   real, additional automated safety net (per this whole effort's own standing "no human gate"
--   decision).
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LearningProposalRepository.markAutoApplied`'s new `slotGuardBlockedItems` param and
-- `'AUTO_APPLY_BLOCKED_MISSING_SLOTS'` status value can persist a real row.

ALTER TABLE learning_proposals
  ADD COLUMN slot_guard_blocked_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE learning_proposals
  DROP CONSTRAINT learning_proposals_status_check;

ALTER TABLE learning_proposals
  ADD CONSTRAINT learning_proposals_status_check
  CHECK (status IN (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'AUTO_APPLIED',
    'AUTO_APPLY_BLOCKED_BY_SANDBOX',
    'AUTO_APPLY_BLOCKED_MISSING_SLOTS'
  ));
