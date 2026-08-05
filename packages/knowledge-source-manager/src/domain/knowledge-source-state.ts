/**
 * "SOURCE LIFECYCLE: Created, Registered, Configured, Validated, Enabled, Disabled,
 * Scheduled, Synchronizing, Paused, Archived, Deleted, Destroyed."
 * (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md) — the exact 12-state list from the
 * prompt, in the prompt's own order.
 */
export enum KnowledgeSourceState {
  CREATED = "created",
  REGISTERED = "registered",
  CONFIGURED = "configured",
  VALIDATED = "validated",
  ENABLED = "enabled",
  DISABLED = "disabled",
  SCHEDULED = "scheduled",
  SYNCHRONIZING = "synchronizing",
  PAUSED = "paused",
  ARCHIVED = "archived",
  DELETED = "deleted",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-source-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal.
 * Judgment call: the prompt lists the 12 states but not the edges between them (unlike
 * prior Knowledge packages, this lifecycle also has no "Failed" state at all — pipeline
 * failures throw and simply do not advance the state machine). This table was designed
 * to connect every one of the 12 named states into one coherent graph: Created ->
 * Registered -> Configured -> Validated -> (Enabled | Scheduled); Enabled fans out to
 * Disabled/Scheduled/Synchronizing/Paused/Archived; Scheduled/Synchronizing/Paused all
 * loop back to Enabled/Disabled; Disabled/Archived can be re-Enabled or move toward
 * Deleted; Deleted is the only path to the hard-terminal Destroyed.
 */
export const KNOWLEDGE_SOURCE_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeSourceState, readonly KnowledgeSourceState[]>
> = {
  [KnowledgeSourceState.CREATED]: [KnowledgeSourceState.REGISTERED],
  [KnowledgeSourceState.REGISTERED]: [KnowledgeSourceState.CONFIGURED],
  [KnowledgeSourceState.CONFIGURED]: [KnowledgeSourceState.VALIDATED],
  [KnowledgeSourceState.VALIDATED]: [KnowledgeSourceState.ENABLED, KnowledgeSourceState.SCHEDULED],
  [KnowledgeSourceState.ENABLED]: [
    KnowledgeSourceState.DISABLED,
    KnowledgeSourceState.SCHEDULED,
    KnowledgeSourceState.SYNCHRONIZING,
    KnowledgeSourceState.PAUSED,
    KnowledgeSourceState.ARCHIVED,
  ],
  [KnowledgeSourceState.DISABLED]: [
    KnowledgeSourceState.ENABLED,
    KnowledgeSourceState.ARCHIVED,
    KnowledgeSourceState.DELETED,
  ],
  [KnowledgeSourceState.SCHEDULED]: [
    KnowledgeSourceState.SYNCHRONIZING,
    KnowledgeSourceState.ENABLED,
    KnowledgeSourceState.DISABLED,
  ],
  [KnowledgeSourceState.SYNCHRONIZING]: [
    KnowledgeSourceState.ENABLED,
    KnowledgeSourceState.PAUSED,
    KnowledgeSourceState.DISABLED,
  ],
  [KnowledgeSourceState.PAUSED]: [
    KnowledgeSourceState.ENABLED,
    KnowledgeSourceState.SYNCHRONIZING,
    KnowledgeSourceState.DISABLED,
  ],
  [KnowledgeSourceState.ARCHIVED]: [KnowledgeSourceState.ENABLED, KnowledgeSourceState.DELETED],
  [KnowledgeSourceState.DELETED]: [KnowledgeSourceState.DESTROYED],
  [KnowledgeSourceState.DESTROYED]: [],
};

/** The single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_SOURCE_TERMINAL_STATES: ReadonlySet<KnowledgeSourceState> = new Set([
  KnowledgeSourceState.DESTROYED,
]);

/** States a Source is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_SOURCE_SETTLED_STATES: ReadonlySet<KnowledgeSourceState> = new Set([
  KnowledgeSourceState.DISABLED,
  KnowledgeSourceState.ARCHIVED,
  KnowledgeSourceState.DELETED,
  KnowledgeSourceState.DESTROYED,
]);
