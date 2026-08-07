/**
 * "PACKAGE STATUS: Draft, Submitted, Reviewing, Certified, Published, Deprecated,
 * Suspended, Archived, Removed." / "LIFECYCLE: Implement strict FSM ... Removed is
 * terminal." (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md) — the exact 9-state list,
 * in the prompt's own order.
 */
export enum MarketplacePackageStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  REVIEWING = "reviewing",
  CERTIFIED = "certified",
  PUBLISHED = "published",
  DEPRECATED = "deprecated",
  SUSPENDED = "suspended",
  ARCHIVED = "archived",
  REMOVED = "removed",
}

/**
 * The authoritative transition table — `state-machine/knowledge-marketplace-state-machine.ts`
 * is the only code allowed to consult this to decide whether a transition is legal.
 * Draft -> Submitted -> Reviewing -> Certified -> Published is the mainline publishing
 * path; a Reviewing Listing may be sent back to Draft on rejection; a Published Listing
 * fans out to Deprecated/Suspended/Archived; Suspended can be re-Published or Archived;
 * Deprecated can be Archived. Every non-terminal state has an edge to the hard-terminal
 * Removed.
 */
export const MARKETPLACE_STATE_TRANSITIONS: Readonly<
  Record<MarketplacePackageStatus, readonly MarketplacePackageStatus[]>
> = {
  [MarketplacePackageStatus.DRAFT]: [
    MarketplacePackageStatus.SUBMITTED,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.SUBMITTED]: [
    MarketplacePackageStatus.REVIEWING,
    MarketplacePackageStatus.DRAFT,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.REVIEWING]: [
    MarketplacePackageStatus.CERTIFIED,
    MarketplacePackageStatus.DRAFT,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.CERTIFIED]: [
    MarketplacePackageStatus.PUBLISHED,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.PUBLISHED]: [
    MarketplacePackageStatus.DEPRECATED,
    MarketplacePackageStatus.SUSPENDED,
    MarketplacePackageStatus.ARCHIVED,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.DEPRECATED]: [
    MarketplacePackageStatus.ARCHIVED,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.SUSPENDED]: [
    MarketplacePackageStatus.PUBLISHED,
    MarketplacePackageStatus.ARCHIVED,
    MarketplacePackageStatus.REMOVED,
  ],
  [MarketplacePackageStatus.ARCHIVED]: [MarketplacePackageStatus.REMOVED],
  [MarketplacePackageStatus.REMOVED]: [],
};

/** "Removed is terminal." — the single hard-terminal state (no outgoing edges). */
export const MARKETPLACE_TERMINAL_STATES: ReadonlySet<MarketplacePackageStatus> = new Set([
  MarketplacePackageStatus.REMOVED,
]);

/** States a Listing is "no longer actively progressing" in — a metrics/health categorization, not a state-machine rule. */
export const MARKETPLACE_SETTLED_STATES: ReadonlySet<MarketplacePackageStatus> = new Set([
  MarketplacePackageStatus.DEPRECATED,
  MarketplacePackageStatus.SUSPENDED,
  MarketplacePackageStatus.ARCHIVED,
  MarketplacePackageStatus.REMOVED,
]);
