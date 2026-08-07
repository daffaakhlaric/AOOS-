/**
 * "LIFECYCLE: Implement strict FSM. States: Draft, Queued, Preparing, Validating,
 * Reviewing, Approved, Rejected, Cancelled, Archived, Destroyed. Destroyed is
 * terminal." (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md) — the exact 10-state list, in
 * the prompt's own order. Unlike every prior sibling package (which has a single
 * "success" terminal-adjacent state, e.g. Completed), this Lifecycle has TWO distinct
 * settled outcomes reachable from Reviewing: Approved AND Rejected — see
 * docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Decision Lifecycle" for the full
 * judgment call.
 */
export enum KnowledgeValidationState {
  DRAFT = "draft",
  QUEUED = "queued",
  PREPARING = "preparing",
  VALIDATING = "validating",
  REVIEWING = "reviewing",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  ARCHIVED = "archived",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-validator-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal. The
 * spec lists the 10 states but not the edges between them; this table is a documented
 * judgment call (see docs/005.7M-KNOWLEDGE-VALIDATOR-AI-REPORT.md — "Decision Lifecycle").
 *
 * Mainline path: Draft -> Queued -> Preparing -> Validating -> Reviewing, then Reviewing
 * fans out into EITHER Approved OR Rejected (both are settled, non-terminal outcomes).
 * Every non-terminal, non-settled state can also be Cancelled or Destroyed directly.
 * Approved, Rejected, and Cancelled all fan into Archived, and every state (including
 * Archived) has an edge into the hard-terminal Destroyed. Every one of the 10 states is
 * reachable from Draft; Destroyed has no outgoing edges; Approved and Rejected are both
 * independently reachable from Reviewing.
 */
export const KNOWLEDGE_VALIDATION_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeValidationState, readonly KnowledgeValidationState[]>
> = {
  [KnowledgeValidationState.DRAFT]: [
    KnowledgeValidationState.QUEUED,
    KnowledgeValidationState.CANCELLED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.QUEUED]: [
    KnowledgeValidationState.PREPARING,
    KnowledgeValidationState.CANCELLED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.PREPARING]: [
    KnowledgeValidationState.VALIDATING,
    KnowledgeValidationState.CANCELLED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.VALIDATING]: [
    KnowledgeValidationState.REVIEWING,
    KnowledgeValidationState.CANCELLED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.REVIEWING]: [
    KnowledgeValidationState.APPROVED,
    KnowledgeValidationState.REJECTED,
    KnowledgeValidationState.CANCELLED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.APPROVED]: [
    KnowledgeValidationState.ARCHIVED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.REJECTED]: [
    KnowledgeValidationState.ARCHIVED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.CANCELLED]: [
    KnowledgeValidationState.ARCHIVED,
    KnowledgeValidationState.DESTROYED,
  ],
  [KnowledgeValidationState.ARCHIVED]: [KnowledgeValidationState.DESTROYED],
  [KnowledgeValidationState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_VALIDATION_TERMINAL_STATES: ReadonlySet<KnowledgeValidationState> = new Set([
  KnowledgeValidationState.DESTROYED,
]);

/** States a Validation is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_VALIDATION_SETTLED_STATES: ReadonlySet<KnowledgeValidationState> = new Set([
  KnowledgeValidationState.APPROVED,
  KnowledgeValidationState.REJECTED,
  KnowledgeValidationState.CANCELLED,
  KnowledgeValidationState.ARCHIVED,
  KnowledgeValidationState.DESTROYED,
]);
