/** "RUNTIME LIFECYCLE" (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — the full Knowledge Runtime Instance lifecycle. */
export enum KnowledgeRuntimeState {
  CREATED = "created",
  LOADING = "loading",
  LOADED = "loaded",
  VALIDATING = "validating",
  READY = "ready",
  RUNNING = "running",
  SUSPENDED = "suspended",
  RESUMING = "resuming",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  DESTROYED = "destroyed",
}

/** The authoritative transition table — `state-machine/knowledge-runtime-state-machine.ts` is the only code allowed to consult this to decide whether a transition is legal. */
export const KNOWLEDGE_RUNTIME_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeRuntimeState, readonly KnowledgeRuntimeState[]>
> = {
  [KnowledgeRuntimeState.CREATED]: [KnowledgeRuntimeState.LOADING, KnowledgeRuntimeState.CANCELLED],
  [KnowledgeRuntimeState.LOADING]: [
    KnowledgeRuntimeState.LOADED,
    KnowledgeRuntimeState.FAILED,
    KnowledgeRuntimeState.CANCELLED,
  ],
  [KnowledgeRuntimeState.LOADED]: [
    KnowledgeRuntimeState.VALIDATING,
    KnowledgeRuntimeState.CANCELLED,
  ],
  [KnowledgeRuntimeState.VALIDATING]: [
    KnowledgeRuntimeState.READY,
    KnowledgeRuntimeState.FAILED,
    KnowledgeRuntimeState.CANCELLED,
  ],
  [KnowledgeRuntimeState.READY]: [
    KnowledgeRuntimeState.RUNNING,
    KnowledgeRuntimeState.CANCELLED,
    KnowledgeRuntimeState.EXPIRED,
  ],
  [KnowledgeRuntimeState.RUNNING]: [
    KnowledgeRuntimeState.SUSPENDED,
    KnowledgeRuntimeState.COMPLETED,
    KnowledgeRuntimeState.FAILED,
    KnowledgeRuntimeState.CANCELLED,
  ],
  [KnowledgeRuntimeState.SUSPENDED]: [
    KnowledgeRuntimeState.RESUMING,
    KnowledgeRuntimeState.CANCELLED,
    KnowledgeRuntimeState.EXPIRED,
  ],
  [KnowledgeRuntimeState.RESUMING]: [
    KnowledgeRuntimeState.RUNNING,
    KnowledgeRuntimeState.FAILED,
    KnowledgeRuntimeState.CANCELLED,
  ],
  [KnowledgeRuntimeState.COMPLETED]: [KnowledgeRuntimeState.DESTROYED],
  [KnowledgeRuntimeState.FAILED]: [KnowledgeRuntimeState.DESTROYED],
  [KnowledgeRuntimeState.CANCELLED]: [KnowledgeRuntimeState.DESTROYED],
  [KnowledgeRuntimeState.EXPIRED]: [KnowledgeRuntimeState.DESTROYED],
  [KnowledgeRuntimeState.DESTROYED]: [],
};

/**
 * States Metrics/Health classify as "no longer actively executing" — a metrics/health
 * categorization, not a state-machine rule (mirrors `@aos/workflow-runtime`'s
 * `TERMINAL_INSTANCE_STATES`).
 */
export const KNOWLEDGE_RUNTIME_INACTIVE_STATES: ReadonlySet<KnowledgeRuntimeState> = new Set([
  KnowledgeRuntimeState.COMPLETED,
  KnowledgeRuntimeState.FAILED,
  KnowledgeRuntimeState.CANCELLED,
  KnowledgeRuntimeState.EXPIRED,
  KnowledgeRuntimeState.DESTROYED,
]);

/** The single true terminal state — no transition leaves `DESTROYED`. */
export const KNOWLEDGE_RUNTIME_TERMINAL_STATE = KnowledgeRuntimeState.DESTROYED;
