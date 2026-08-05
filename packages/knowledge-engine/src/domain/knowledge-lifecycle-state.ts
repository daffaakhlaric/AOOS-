/** "KNOWLEDGE LIFECYCLE" (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md) — the 12 states a `KnowledgeAsset` moves through. */
export enum KnowledgeLifecycleState {
  DRAFT = "draft",
  IMPORTED = "imported",
  PENDING_REVIEW = "pending_review",
  APPROVED = "approved",
  PUBLISHED = "published",
  INDEXED = "indexed",
  DEPRECATED = "deprecated",
  ARCHIVED = "archived",
  DISABLED = "disabled",
  DELETED = "deleted",
  EXPIRED = "expired",
  VERSIONED = "versioned",
}

/**
 * The authoritative Lifecycle State transition table — `lifecycle/knowledge-lifecycle.ts`
 * is the only code allowed to change a `KnowledgeAsset`'s `lifecycleState`, and every
 * transition not present here throws `IllegalLifecycleTransitionException`.
 */
export const KNOWLEDGE_LIFECYCLE_TRANSITIONS: Readonly<
  Record<KnowledgeLifecycleState, readonly KnowledgeLifecycleState[]>
> = {
  [KnowledgeLifecycleState.DRAFT]: [
    KnowledgeLifecycleState.PENDING_REVIEW,
    KnowledgeLifecycleState.ARCHIVED,
  ],
  [KnowledgeLifecycleState.IMPORTED]: [
    KnowledgeLifecycleState.PENDING_REVIEW,
    KnowledgeLifecycleState.ARCHIVED,
  ],
  [KnowledgeLifecycleState.PENDING_REVIEW]: [
    KnowledgeLifecycleState.APPROVED,
    KnowledgeLifecycleState.DRAFT,
  ],
  [KnowledgeLifecycleState.APPROVED]: [
    KnowledgeLifecycleState.PUBLISHED,
    KnowledgeLifecycleState.ARCHIVED,
  ],
  [KnowledgeLifecycleState.PUBLISHED]: [
    KnowledgeLifecycleState.INDEXED,
    KnowledgeLifecycleState.DEPRECATED,
    KnowledgeLifecycleState.ARCHIVED,
    KnowledgeLifecycleState.VERSIONED,
    KnowledgeLifecycleState.EXPIRED,
  ],
  [KnowledgeLifecycleState.INDEXED]: [
    KnowledgeLifecycleState.DEPRECATED,
    KnowledgeLifecycleState.ARCHIVED,
    KnowledgeLifecycleState.VERSIONED,
    KnowledgeLifecycleState.EXPIRED,
  ],
  [KnowledgeLifecycleState.DEPRECATED]: [
    KnowledgeLifecycleState.ARCHIVED,
    KnowledgeLifecycleState.DISABLED,
  ],
  [KnowledgeLifecycleState.ARCHIVED]: [
    KnowledgeLifecycleState.DELETED,
    KnowledgeLifecycleState.DISABLED,
  ],
  [KnowledgeLifecycleState.DISABLED]: [
    KnowledgeLifecycleState.ARCHIVED,
    KnowledgeLifecycleState.DELETED,
  ],
  [KnowledgeLifecycleState.DELETED]: [],
  [KnowledgeLifecycleState.EXPIRED]: [
    KnowledgeLifecycleState.ARCHIVED,
    KnowledgeLifecycleState.DELETED,
  ],
  [KnowledgeLifecycleState.VERSIONED]: [
    KnowledgeLifecycleState.PUBLISHED,
    KnowledgeLifecycleState.ARCHIVED,
  ],
};

export const KNOWLEDGE_TERMINAL_LIFECYCLE_STATES: ReadonlySet<KnowledgeLifecycleState> = new Set([
  KnowledgeLifecycleState.DELETED,
]);
