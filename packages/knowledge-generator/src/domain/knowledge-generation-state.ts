/**
 * "LIFECYCLE: Implement strict FSM. States: Draft, Queued, Preparing, Generating,
 * Reviewing, Completed, Cancelled, Failed, Archived, Destroyed. Destroyed is terminal."
 * (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 10-state list, in the
 * prompt's own order.
 */
export enum KnowledgeGenerationState {
  DRAFT = "draft",
  QUEUED = "queued",
  PREPARING = "preparing",
  GENERATING = "generating",
  REVIEWING = "reviewing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
  ARCHIVED = "archived",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-generator-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal. The
 * spec lists the 10 states but not the edges between them; this table is a documented
 * judgment call (see docs/005.7K-KNOWLEDGE-GENERATOR-AI-REPORT.md — "Lifecycle").
 *
 * Mainline path: Draft -> Queued -> Preparing -> Generating -> Reviewing -> Completed.
 * Every non-terminal, non-settled state can also be Cancelled or Destroyed directly.
 * Queued/Preparing/Generating/Reviewing can additionally fail into Failed. Completed,
 * Cancelled, and Failed all fan into Archived, and every state (including Archived) has
 * an edge into the hard-terminal Destroyed. Every one of the 10 states is reachable from
 * Draft; Destroyed has no outgoing edges.
 */
export const KNOWLEDGE_GENERATION_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeGenerationState, readonly KnowledgeGenerationState[]>
> = {
  [KnowledgeGenerationState.DRAFT]: [
    KnowledgeGenerationState.QUEUED,
    KnowledgeGenerationState.CANCELLED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.QUEUED]: [
    KnowledgeGenerationState.PREPARING,
    KnowledgeGenerationState.CANCELLED,
    KnowledgeGenerationState.FAILED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.PREPARING]: [
    KnowledgeGenerationState.GENERATING,
    KnowledgeGenerationState.CANCELLED,
    KnowledgeGenerationState.FAILED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.GENERATING]: [
    KnowledgeGenerationState.REVIEWING,
    KnowledgeGenerationState.CANCELLED,
    KnowledgeGenerationState.FAILED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.REVIEWING]: [
    KnowledgeGenerationState.COMPLETED,
    KnowledgeGenerationState.CANCELLED,
    KnowledgeGenerationState.FAILED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.COMPLETED]: [
    KnowledgeGenerationState.ARCHIVED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.CANCELLED]: [
    KnowledgeGenerationState.ARCHIVED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.FAILED]: [
    KnowledgeGenerationState.ARCHIVED,
    KnowledgeGenerationState.DESTROYED,
  ],
  [KnowledgeGenerationState.ARCHIVED]: [KnowledgeGenerationState.DESTROYED],
  [KnowledgeGenerationState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_GENERATION_TERMINAL_STATES: ReadonlySet<KnowledgeGenerationState> = new Set([
  KnowledgeGenerationState.DESTROYED,
]);

/** States a Generation is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_GENERATION_SETTLED_STATES: ReadonlySet<KnowledgeGenerationState> = new Set([
  KnowledgeGenerationState.COMPLETED,
  KnowledgeGenerationState.CANCELLED,
  KnowledgeGenerationState.FAILED,
  KnowledgeGenerationState.ARCHIVED,
  KnowledgeGenerationState.DESTROYED,
]);
