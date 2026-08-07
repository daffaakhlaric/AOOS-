import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";
import type { MarketplacePackageStatus } from "../domain/marketplace-package-status.js";

export interface KnowledgeMarketplaceStateTransitionInput {
  readonly execution: KnowledgeMarketplaceExecution;
  readonly to: MarketplacePackageStatus;
  readonly operation?: string;
  readonly reason?: string;
}

/** Interface implemented by `KnowledgeMarketplaceStateMachine`. */
export interface IKnowledgeMarketplaceStateMachine {
  canTransition(from: MarketplacePackageStatus, to: MarketplacePackageStatus): boolean;
  transition(input: KnowledgeMarketplaceStateTransitionInput): KnowledgeMarketplaceExecution;
}
