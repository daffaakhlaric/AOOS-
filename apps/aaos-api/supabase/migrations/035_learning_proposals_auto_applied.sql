-- AAOS-SELF-IMPROVING (Phase SI-1) -- 035_learning_proposals_auto_applied.sql
-- Extends `learning_proposals` (024_learning_proposals.sql) with real, honest signaling for a
-- CONFIG_UPDATE improvement item that was auto-applied WITHOUT a human approval step -- per the
-- user's own explicit, twice-confirmed decision (see `docs/PROMPT-AAOS-SELF-IMPROVING-FULL.md`'s
-- own header: "FULL auto-apply for ALL types (PROMPT/CONFIG/LOGIC), no human gate").
--
-- Real next migration number verified directly against this folder's actual latest
-- (034_agent_configs.sql) before choosing 035 -- no other 035 exists.
--
-- REAL, DELIBERATE DECISION (documented here, per this phase's own coordinator instruction): a
-- CONFIG_UPDATE item is auto-applied at proposal-PERSIST time (`ConfigApplierService.
-- applyConfigUpdate`, called from `LearningService.persistProposal` right after the proposal row
-- itself is created), NEVER at Approve time -- unlike a `PROMPT_UPDATE` item, which still requires
-- a real human Approve action (`LearningDecisionService.approve`) before
-- `agent_prompt_overrides` is ever written. A proposal can honestly contain BOTH kinds of item at
-- once (one row, mixed `improvements[]`), so reusing the existing `status` CHECK's
-- 'PENDING'/'APPROVED'/'REJECTED' vocabulary for "some items already auto-applied" would be
-- DISHONEST either way: 'APPROVED' would falsely imply a human decided, and leaving it 'PENDING'
-- with no other signal would hide that real config writes already happened. Two additive, real
-- columns instead of overloading `status`:
--
--   `auto_applied_config_keys` (JSONB, default '[]') -- the real `config_key` targets that were
--   successfully auto-applied for this proposal, exactly as `ConfigApplierService.
--   applyConfigUpdate` reports them (never a fabricated list -- an item whose write failed is NOT
--   included here, same "best-effort, log, never lie about what happened" discipline every other
--   side-effect in this codebase follows).
--
--   `status` gains ONE new real value, 'AUTO_APPLIED' -- used ONLY when EVERY improvement item on
--   the proposal was a CONFIG_UPDATE item that was successfully auto-applied (i.e. there is no
--   PROMPT_UPDATE item left genuinely pending human review on this row). A MIXED proposal (some
--   CONFIG_UPDATE items auto-applied, some PROMPT_UPDATE items still needing a human decision) or a
--   proposal where a CONFIG_UPDATE write genuinely failed keeps `status = 'PENDING'` -- honestly
--   reflecting that a human still has real work to do on it (or a real write failure a human should
--   see) -- with `auto_applied_config_keys` on that same row telling the Learning Monitor exactly
--   which items, if any, were already applied automatically. This is the real, distinct signal this
--   phase's own coordinator note asked for, rather than silently reusing 'APPROVED' for something a
--   human never approved.
--
-- NOT auto-applied by this repo's tooling -- run this against the real Supabase project before
-- `LearningProposalRepository.markAutoApplied` can persist a real row.

ALTER TABLE learning_proposals
  ADD COLUMN auto_applied_config_keys JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE learning_proposals
  DROP CONSTRAINT learning_proposals_status_check;

ALTER TABLE learning_proposals
  ADD CONSTRAINT learning_proposals_status_check
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPLIED'));
