/**
 * "LIFECYCLE: Implement strict FSM. States: Draft, Queued, Preparing, Assessing,
 * Reviewing, Completed, Cancelled, Failed, Archived, Destroyed. Destroyed is terminal."
 * (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md) — the exact 10-state list, in the
 * prompt's own order.
 */
export enum KnowledgeQualityAssessmentState {
  DRAFT = "draft",
  QUEUED = "queued",
  PREPARING = "preparing",
  ASSESSING = "assessing",
  REVIEWING = "reviewing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
  ARCHIVED = "archived",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-quality-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal. The
 * spec lists the 10 states but not the edges between them; this table is a documented
 * judgment call (see docs/005.7L-KNOWLEDGE-QUALITY-ENGINE-REPORT.md — "Lifecycle").
 *
 * Mainline path: Draft -> Queued -> Preparing -> Assessing -> Reviewing -> Completed.
 * Every non-terminal, non-settled state can also be Cancelled or Destroyed directly.
 * Queued/Preparing/Assessing/Reviewing can additionally fail into Failed. Completed,
 * Cancelled, and Failed all fan into Archived, and every state (including Archived) has
 * an edge into the hard-terminal Destroyed. Every one of the 10 states is reachable from
 * Draft; Destroyed has no outgoing edges.
 */
export const KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeQualityAssessmentState, readonly KnowledgeQualityAssessmentState[]>
> = {
  [KnowledgeQualityAssessmentState.DRAFT]: [
    KnowledgeQualityAssessmentState.QUEUED,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.QUEUED]: [
    KnowledgeQualityAssessmentState.PREPARING,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.FAILED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.PREPARING]: [
    KnowledgeQualityAssessmentState.ASSESSING,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.FAILED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.ASSESSING]: [
    KnowledgeQualityAssessmentState.REVIEWING,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.FAILED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.REVIEWING]: [
    KnowledgeQualityAssessmentState.COMPLETED,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.FAILED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.COMPLETED]: [
    KnowledgeQualityAssessmentState.ARCHIVED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.CANCELLED]: [
    KnowledgeQualityAssessmentState.ARCHIVED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.FAILED]: [
    KnowledgeQualityAssessmentState.ARCHIVED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ],
  [KnowledgeQualityAssessmentState.ARCHIVED]: [KnowledgeQualityAssessmentState.DESTROYED],
  [KnowledgeQualityAssessmentState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_QUALITY_ASSESSMENT_TERMINAL_STATES: ReadonlySet<KnowledgeQualityAssessmentState> =
  new Set([KnowledgeQualityAssessmentState.DESTROYED]);

/** States a Assessment is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_QUALITY_ASSESSMENT_SETTLED_STATES: ReadonlySet<KnowledgeQualityAssessmentState> =
  new Set([
    KnowledgeQualityAssessmentState.COMPLETED,
    KnowledgeQualityAssessmentState.CANCELLED,
    KnowledgeQualityAssessmentState.FAILED,
    KnowledgeQualityAssessmentState.ARCHIVED,
    KnowledgeQualityAssessmentState.DESTROYED,
  ]);
