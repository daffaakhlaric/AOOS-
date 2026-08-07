import type {
  MarketplaceHistoryEntry,
  KnowledgeMarketplaceExecution,
} from "../domain/knowledge-marketplace-execution.js";
import {
  MARKETPLACE_STATE_TRANSITIONS,
  MarketplacePackageStatus,
} from "../domain/marketplace-package-status.js";
import { IllegalMarketplaceTransitionException } from "../errors/illegal-marketplace-transition-exception.js";
import { generateId } from "../utils/id.js";

import type {
  IKnowledgeMarketplaceStateMachine,
  KnowledgeMarketplaceStateTransitionInput,
} from "./i-state-machine.js";

/**
 * "Implement strict FSM. ... Removed is terminal." (docs/PROMPT-005.7J-KNOWLEDGE-
 * MARKETPLACE.md) — the only code in this package allowed to change
 * `MarketplaceListing.state`. Appends one immutable history entry per legal transition
 * and stamps `publishedAt`/`removedAt` on the corresponding transitions.
 */
export class KnowledgeMarketplaceStateMachine implements IKnowledgeMarketplaceStateMachine {
  canTransition(from: MarketplacePackageStatus, to: MarketplacePackageStatus): boolean {
    return MARKETPLACE_STATE_TRANSITIONS[from].includes(to);
  }

  transition(input: KnowledgeMarketplaceStateTransitionInput): KnowledgeMarketplaceExecution {
    const { execution, to, operation, reason } = input;
    const from = execution.instance.state;
    if (!this.canTransition(from, to)) {
      throw new IllegalMarketplaceTransitionException(
        `Illegal Knowledge Marketplace State transition for "${execution.instance.token}": "${from}" -> "${to}"`,
      );
    }

    const now = new Date().toISOString();
    const historyEntry: MarketplaceHistoryEntry = {
      id: generateId(),
      sequence: execution.history.length,
      listingId: execution.metadata.listingId,
      operation: operation ?? "transition",
      fromState: from,
      toState: to,
      reason,
      occurredAt: now,
    };

    return {
      ...execution,
      instance: {
        ...execution.instance,
        state: to,
        updatedAt: now,
        publishedAt:
          to === MarketplacePackageStatus.PUBLISHED ? now : execution.instance.publishedAt,
        removedAt: to === MarketplacePackageStatus.REMOVED ? now : execution.instance.removedAt,
      },
      history: [...execution.history, historyEntry],
    };
  }
}
