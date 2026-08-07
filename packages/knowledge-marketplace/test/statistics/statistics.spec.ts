import { describe, expect, it } from "vitest";

import { MarketplaceCategoryName } from "../../src/domain/marketplace-category-name.js";
import { KnowledgeMarketplaceStatistics } from "../../src/statistics/knowledge-marketplace-statistics.js";

describe("KnowledgeMarketplaceStatistics", () => {
  it("get returns empty statistics for an untouched category", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    expect(statistics.get(MarketplaceCategoryName.FINANCE).listedCount).toBe(0);
  });

  it("recordListed increments listedCount", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    statistics.recordListed(MarketplaceCategoryName.FINANCE);
    statistics.recordListed(MarketplaceCategoryName.FINANCE);
    expect(statistics.get(MarketplaceCategoryName.FINANCE).listedCount).toBe(2);
  });

  it("recordPublished increments publishedCount", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    statistics.recordPublished(MarketplaceCategoryName.FINANCE);
    expect(statistics.get(MarketplaceCategoryName.FINANCE).publishedCount).toBe(1);
  });

  it("recordListed stamps lastActivityAt", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    const snapshot = statistics.recordListed(MarketplaceCategoryName.GENERAL);
    expect(snapshot.lastActivityAt).toBeDefined();
  });

  it("tracks categories independently", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    statistics.recordListed(MarketplaceCategoryName.FINANCE);
    expect(statistics.get(MarketplaceCategoryName.HR).listedCount).toBe(0);
  });

  it("recordPublished preserves listedCount", () => {
    const statistics = new KnowledgeMarketplaceStatistics();
    statistics.recordListed(MarketplaceCategoryName.GENERAL);
    const snapshot = statistics.recordPublished(MarketplaceCategoryName.GENERAL);
    expect(snapshot.listedCount).toBe(1);
    expect(snapshot.publishedCount).toBe(1);
  });
});
