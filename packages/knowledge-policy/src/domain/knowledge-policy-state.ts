/**
 * "LIFECYCLE: Draft, Created, Validated, Active, Suspended, Deprecated, Archived,
 * Restored, Destroyed." (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — the exact 9-state
 * list from the prompt, in the prompt's own order.
 */
export enum KnowledgePolicyState {
  DRAFT = "draft",
  CREATED = "created",
  VALIDATED = "validated",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  DEPRECATED = "deprecated",
  ARCHIVED = "archived",
  RESTORED = "restored",
  DESTROYED = "destroyed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-policy-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal.
 * Draft -> Created -> Validated -> Active is the mainline authoring path; an Active policy
 * fans out to Suspended/Deprecated/Archived; Suspended can be Restored or Archived;
 * Deprecated can be Archived or Restored; Archived can be Restored; Restored re-enters
 * Active. Every non-terminal state has an edge to the hard-terminal Destroyed.
 */
export const KNOWLEDGE_POLICY_STATE_TRANSITIONS: Readonly<
  Record<KnowledgePolicyState, readonly KnowledgePolicyState[]>
> = {
  [KnowledgePolicyState.DRAFT]: [KnowledgePolicyState.CREATED, KnowledgePolicyState.DESTROYED],
  [KnowledgePolicyState.CREATED]: [KnowledgePolicyState.VALIDATED, KnowledgePolicyState.DESTROYED],
  [KnowledgePolicyState.VALIDATED]: [KnowledgePolicyState.ACTIVE, KnowledgePolicyState.DESTROYED],
  [KnowledgePolicyState.ACTIVE]: [
    KnowledgePolicyState.SUSPENDED,
    KnowledgePolicyState.DEPRECATED,
    KnowledgePolicyState.ARCHIVED,
    KnowledgePolicyState.DESTROYED,
  ],
  [KnowledgePolicyState.SUSPENDED]: [
    KnowledgePolicyState.ACTIVE,
    KnowledgePolicyState.ARCHIVED,
    KnowledgePolicyState.RESTORED,
    KnowledgePolicyState.DESTROYED,
  ],
  [KnowledgePolicyState.DEPRECATED]: [
    KnowledgePolicyState.ARCHIVED,
    KnowledgePolicyState.RESTORED,
    KnowledgePolicyState.DESTROYED,
  ],
  [KnowledgePolicyState.ARCHIVED]: [KnowledgePolicyState.RESTORED, KnowledgePolicyState.DESTROYED],
  [KnowledgePolicyState.RESTORED]: [
    KnowledgePolicyState.ACTIVE,
    KnowledgePolicyState.ARCHIVED,
    KnowledgePolicyState.DESTROYED,
  ],
  [KnowledgePolicyState.DESTROYED]: [],
};

/** "Destroyed is terminal." — the single hard-terminal state (no outgoing edges). */
export const KNOWLEDGE_POLICY_TERMINAL_STATES: ReadonlySet<KnowledgePolicyState> = new Set([
  KnowledgePolicyState.DESTROYED,
]);

/** States a Policy is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const KNOWLEDGE_POLICY_SETTLED_STATES: ReadonlySet<KnowledgePolicyState> = new Set([
  KnowledgePolicyState.SUSPENDED,
  KnowledgePolicyState.DEPRECATED,
  KnowledgePolicyState.ARCHIVED,
  KnowledgePolicyState.DESTROYED,
]);
