import { StrategyNotFoundException } from "../errors/strategy-not-found-exception.js";
import type { KnowledgeUpdateType } from "../types/update-type.js";

import { DependencyUpdateStrategy } from "./dependency-update-strategy.js";
import { EmergencyUpdateStrategy } from "./emergency-update-strategy.js";
import { FullUpdateStrategy } from "./full-update-strategy.js";
import type { IKnowledgeUpdateStrategy } from "./i-knowledge-update-strategy.js";
import { IncrementalUpdateStrategy } from "./incremental-update-strategy.js";
import { ManualUpdateStrategy } from "./manual-update-strategy.js";
import { MetadataUpdateStrategy } from "./metadata-update-strategy.js";
import { PolicyUpdateStrategy } from "./policy-update-strategy.js";
import { RecoveryUpdateStrategy } from "./recovery-update-strategy.js";
import { RefreshUpdateStrategy } from "./refresh-update-strategy.js";
import { RetryUpdateStrategy } from "./retry-update-strategy.js";
import { ScheduledUpdateStrategy } from "./scheduled-update-strategy.js";
import { SynchronizationUpdateStrategy } from "./synchronization-update-strategy.js";
import { VersionUpdateStrategy } from "./version-update-strategy.js";

/**
 * Id-keyed (by `KnowledgeUpdateType`) registry of the 13 concrete strategies. The pipeline's
 * Execute Update stage calls `resolve(updateType)` and dispatches to the returned strategy object
 * — never an if/else chain.
 */
export class KnowledgeUpdateStrategyRegistry {
  private readonly strategies = new Map<KnowledgeUpdateType, IKnowledgeUpdateStrategy>();

  constructor(strategies?: readonly IKnowledgeUpdateStrategy[]) {
    for (const strategy of strategies ?? KnowledgeUpdateStrategyRegistry.defaults()) {
      this.strategies.set(strategy.updateType, strategy);
    }
  }

  static defaults(): IKnowledgeUpdateStrategy[] {
    return [
      new ManualUpdateStrategy(),
      new ScheduledUpdateStrategy(),
      new IncrementalUpdateStrategy(),
      new FullUpdateStrategy(),
      new RefreshUpdateStrategy(),
      new SynchronizationUpdateStrategy(),
      new VersionUpdateStrategy(),
      new MetadataUpdateStrategy(),
      new PolicyUpdateStrategy(),
      new DependencyUpdateStrategy(),
      new RecoveryUpdateStrategy(),
      new RetryUpdateStrategy(),
      new EmergencyUpdateStrategy(),
    ];
  }

  resolve(updateType: KnowledgeUpdateType): IKnowledgeUpdateStrategy {
    const strategy = this.strategies.get(updateType);
    if (!strategy) throw new StrategyNotFoundException(updateType);
    return strategy;
  }
}
