/**
 * "LIFECYCLE: Draft, Created, Validated, Published, Superseded, Deprecated, Archived,
 * Restored, Merged, RolledBack, Destroyed." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md)
 * — the exact 11-state list from the prompt, in the prompt's own order.
 */
export enum KnowledgeVersionState {
  DRAFT = "draft",
  CREATED = "created",
  VALIDATED = "validated",
  PUBLISHED = "published",
  SUPERSEDED = "superseded",
  DEPRECATED = "deprecated",
  ARCHIVED = "archived",
  RESTORED = "restored",
  MERGED = "merged",
  ROLLED_BACK = "rolledback",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-version-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal.
 * Judgment call: the prompt lists the 11 states and the two rules ("Destroyed is
 * terminal", "Illegal transitions MUST throw validation errors") but no edges, so this
 * table was designed to connect every state into one coherent graph: Draft -> Created ->
 * Validated -> Published is the mainline authoring path; a Published version fans out to
 * Superseded (a newer version replaced it), Deprecated (discouraged but still visible),
 * Archived (shelved), Merged (merged into another version), and RolledBack (undone in
 * favour of an earlier version); Deprecated/Archived/RolledBack can be Restored, and a
 * Restored version may be re-Published; a Validated (not yet published) version may be
 * Merged directly. Every non-terminal state has an edge to the hard-terminal Destroyed.
 */
export const KNOWLEDGE_VERSION_STATE_TRANSITIONS: Readonly<
  Record<KnowledgeVersionState, readonly KnowledgeVersionState[]>
> = {
  [KnowledgeVersionState.DRAFT]: [KnowledgeVersionState.CREATED, KnowledgeVersionState.DESTROYED],
  [KnowledgeVersionState.CREATED]: [
    KnowledgeVersionState.VALIDATED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.VALIDATED]: [
    KnowledgeVersionState.PUBLISHED,
    KnowledgeVersionState.MERGED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.PUBLISHED]: [
    KnowledgeVersionState.SUPERSEDED,
    KnowledgeVersionState.DEPRECATED,
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.MERGED,
    KnowledgeVersionState.ROLLED_BACK,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.SUPERSEDED]: [
    KnowledgeVersionState.DEPRECATED,
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.DEPRECATED]: [
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.RESTORED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.ARCHIVED]: [
    KnowledgeVersionState.RESTORED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.RESTORED]: [
    KnowledgeVersionState.PUBLISHED,
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.MERGED]: [
    KnowledgeVersionState.SUPERSEDED,
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.ROLLED_BACK]: [
    KnowledgeVersionState.RESTORED,
    KnowledgeVersionState.ARCHIVED,
    KnowledgeVersionState.DESTROYED,
  ],
  [KnowledgeVersionState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_VERSION_TERMINAL_STATES: ReadonlySet<KnowledgeVersionState> = new Set([
  KnowledgeVersionState.DESTROYED,
]);

/** States a Version is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_VERSION_SETTLED_STATES: ReadonlySet<KnowledgeVersionState> = new Set([
  KnowledgeVersionState.SUPERSEDED,
  KnowledgeVersionState.DEPRECATED,
  KnowledgeVersionState.ARCHIVED,
  KnowledgeVersionState.MERGED,
  KnowledgeVersionState.ROLLED_BACK,
  KnowledgeVersionState.DESTROYED,
]);
