import type { MarketplaceCategoryName } from "../domain/marketplace-category-name.js";
import {
  EMPTY_MARKETPLACE_STATISTICS,
  type MarketplaceStatisticsSnapshot,
} from "../domain/marketplace-statistics-snapshot.js";

/**
 * "KnowledgeMarketplaceStatistics" (docs/PROMPT-005.7J-KNOWLEDGE-MARKETPLACE.md —
 * "Public API") — per-`MarketplaceCategoryName` bookkeeping.
 */
export class KnowledgeMarketplaceStatistics {
  private readonly statsByCategory = new Map<
    MarketplaceCategoryName,
    MarketplaceStatisticsSnapshot
  >();

  get(category: MarketplaceCategoryName): MarketplaceStatisticsSnapshot {
    return this.statsByCategory.get(category) ?? EMPTY_MARKETPLACE_STATISTICS;
  }

  recordListed(category: MarketplaceCategoryName): MarketplaceStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: MarketplaceStatisticsSnapshot = {
      listedCount: current.listedCount + 1,
      publishedCount: current.publishedCount,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }

  recordPublished(category: MarketplaceCategoryName): MarketplaceStatisticsSnapshot {
    const current = this.get(category);
    const snapshot: MarketplaceStatisticsSnapshot = {
      listedCount: current.listedCount,
      publishedCount: current.publishedCount + 1,
      lastActivityAt: new Date().toISOString(),
    };
    this.statsByCategory.set(category, snapshot);
    return snapshot;
  }
}
