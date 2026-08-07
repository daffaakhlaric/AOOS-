/**
 * "LIFECYCLE: Implement strict FSM. States: Draft, Queued, Preparing, Embedding,
 * Completed, Cancelled, Failed, Archived, Destroyed. Destroyed is terminal."
 * (docs/PROMPT-005.7N-EMBEDDING-MANAGER.md) — the exact 9-state list, in the prompt's
 * own order. NOTE: `EMBEDDING` here is a *state value* on this enum (the in-progress
 * "generation is happening, delegated to a provider" state) — it is spelled identically
 * to `Embedding`, the primary domain aggregate class (`./embedding.ts`) and to the
 * package's own name. Every reference to the enum value in code/comments is written as
 * `EmbeddingState.EMBEDDING` to keep the two unambiguous.
 */
export enum EmbeddingState {
  DRAFT = "draft",
  QUEUED = "queued",
  PREPARING = "preparing",
  EMBEDDING = "embedding",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
  ARCHIVED = "archived",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/embedding-state-machine.ts` is the
 * only code allowed to consult this to decide whether a transition is legal. The spec
 * lists the 9 states but not the edges between them; this table is a documented
 * judgment call (see docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Lifecycle").
 *
 * Mainline path: Draft -> Queued -> Preparing -> Embedding -> Completed. Unlike
 * `KnowledgeValidator` (005.7M), this Lifecycle has no separate "Reviewing" checkpoint —
 * Preparing runs Provider/Model/Namespace/Configuration Resolution directly, and
 * Embedding is the single in-flight working state. Preparing and Embedding may both fail
 * outright (-> Failed) since an externally supplied `IEmbeddingProvider` can reject.
 * Every non-terminal, non-settled state can also be Cancelled or Destroyed directly.
 * Completed, Failed, and Cancelled all fan into Archived, and every state (including
 * Archived) has an edge into the hard-terminal Destroyed. Every one of the 9 states is
 * reachable from Draft; Destroyed has no outgoing edges.
 */
export const EMBEDDING_STATE_TRANSITIONS: Readonly<
  Record<EmbeddingState, readonly EmbeddingState[]>
> = {
  [EmbeddingState.DRAFT]: [
    EmbeddingState.QUEUED,
    EmbeddingState.CANCELLED,
    EmbeddingState.DESTROYED,
  ],
  [EmbeddingState.QUEUED]: [
    EmbeddingState.PREPARING,
    EmbeddingState.CANCELLED,
    EmbeddingState.DESTROYED,
  ],
  [EmbeddingState.PREPARING]: [
    EmbeddingState.EMBEDDING,
    EmbeddingState.FAILED,
    EmbeddingState.CANCELLED,
    EmbeddingState.DESTROYED,
  ],
  [EmbeddingState.EMBEDDING]: [
    EmbeddingState.COMPLETED,
    EmbeddingState.FAILED,
    EmbeddingState.CANCELLED,
    EmbeddingState.DESTROYED,
  ],
  [EmbeddingState.COMPLETED]: [EmbeddingState.ARCHIVED, EmbeddingState.DESTROYED],
  [EmbeddingState.FAILED]: [EmbeddingState.ARCHIVED, EmbeddingState.DESTROYED],
  [EmbeddingState.CANCELLED]: [EmbeddingState.ARCHIVED, EmbeddingState.DESTROYED],
  [EmbeddingState.ARCHIVED]: [EmbeddingState.DESTROYED],
  [EmbeddingState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const EMBEDDING_TERMINAL_STATES: ReadonlySet<EmbeddingState> = new Set([
  EmbeddingState.DESTROYED,
]);

/** States an Embedding is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const EMBEDDING_SETTLED_STATES: ReadonlySet<EmbeddingState> = new Set([
  EmbeddingState.COMPLETED,
  EmbeddingState.FAILED,
  EmbeddingState.CANCELLED,
  EmbeddingState.ARCHIVED,
  EmbeddingState.DESTROYED,
]);
