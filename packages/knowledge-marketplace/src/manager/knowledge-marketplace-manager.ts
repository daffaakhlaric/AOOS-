import type { KnowledgeMarketplaceExecution } from "../domain/knowledge-marketplace-execution.js";
import { MarketplaceNotFoundException } from "../errors/marketplace-not-found-exception.js";
import { KnowledgeMarketplaceRegistryBucket } from "../registry/knowledge-marketplace-registry-bucket.js";
import type { KnowledgeMarketplaceRegistry } from "../registry/knowledge-marketplace-registry.js";
import type { MarketplaceRegistryEntry } from "../registry/marketplace-registry-entry.js";
import type { KnowledgeMarketplaceSession } from "../session/knowledge-marketplace-session.js";
import { KnowledgeMarketplaceStatistics } from "../statistics/knowledge-marketplace-statistics.js";

/**
 * "KnowledgeMarketplaceManager" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md — "Public
 * API") — mid-level orchestrator composing Registry + Session + Statistics +
 * executionsByToken (token-keyed ledger; Map lookups only, never array-scan).
 */
export class KnowledgeMarketplaceManager {
  private readonly executionsByToken = new Map<string, KnowledgeMarketplaceExecution>();
  readonly statistics = new KnowledgeMarketplaceStatistics();

  constructor(
    readonly registry: KnowledgeMarketplaceRegistry,
    readonly session: KnowledgeMarketplaceSession,
  ) {}

  register(
    token: string,
    execution: KnowledgeMarketplaceExecution,
    entry: MarketplaceRegistryEntry,
  ): void {
    this.registry.register(KnowledgeMarketplaceRegistryBucket.LISTING, entry);
    this.executionsByToken.set(token, execution);
    this.statistics.recordListed(execution.metadata.category);
  }

  get(token: string): KnowledgeMarketplaceExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: string): KnowledgeMarketplaceExecution {
    const execution = this.get(token);
    if (!execution) {
      throw new MarketplaceNotFoundException(`No execution registered for token "${token}"`);
    }
    return execution;
  }

  update(token: string, execution: KnowledgeMarketplaceExecution): void {
    if (!this.executionsByToken.has(token)) {
      throw new MarketplaceNotFoundException(`No execution registered for token "${token}"`);
    }
    this.executionsByToken.set(token, execution);
  }

  unregister(token: string): boolean {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      return false;
    }
    this.registry.remove(KnowledgeMarketplaceRegistryBucket.LISTING, execution.metadata.listingId);
    this.executionsByToken.delete(token);
    return true;
  }

  list(): readonly KnowledgeMarketplaceExecution[] {
    return Array.from(this.executionsByToken.values());
  }

  count(): number {
    return this.executionsByToken.size;
  }
}
