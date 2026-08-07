import {
  MARKETPLACE_SETTLED_STATES,
  MARKETPLACE_STATE_TRANSITIONS,
  MARKETPLACE_TERMINAL_STATES,
  MarketplacePackageStatus,
} from "../domain/marketplace-package-status.js";

/**
 * "KnowledgeMarketplaceLifecycle" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md —
 * "Public API") — a read-only, query-only companion to `KnowledgeMarketplaceStateMachine`
 * (which performs the actual mutations). Lets a caller introspect the 9-state Package
 * Status Lifecycle without importing the domain transition table directly.
 */
export class KnowledgeMarketplaceLifecycle {
  states(): readonly MarketplacePackageStatus[] {
    return Object.values(MarketplacePackageStatus);
  }

  transitionsFrom(state: MarketplacePackageStatus): readonly MarketplacePackageStatus[] {
    return MARKETPLACE_STATE_TRANSITIONS[state];
  }

  isTerminal(state: MarketplacePackageStatus): boolean {
    return MARKETPLACE_TERMINAL_STATES.has(state);
  }

  isSettled(state: MarketplacePackageStatus): boolean {
    return MARKETPLACE_SETTLED_STATES.has(state);
  }
}
