import { describe, expect, it } from "vitest";

import { KnowledgeUsageAnalytics } from "../../src/analytics/knowledge-usage-analytics.js";

describe("KnowledgeUsageAnalytics", () => {
  it("accumulates documentCount across recordDocumentAdded calls", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordDocumentAdded();
    usage.recordDocumentAdded(4);
    expect(usage.documentCount()).toBe(5);
  });

  it("returns 0 documentCount with no recordings", () => {
    expect(new KnowledgeUsageAnalytics().documentCount()).toBe(0);
  });

  it("accumulates indexedCount", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordDocumentIndexed(3);
    usage.recordDocumentIndexed(2);
    expect(usage.indexedCount()).toBe(5);
  });

  it("accumulates deletedCount", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordDocumentDeleted();
    expect(usage.deletedCount()).toBe(1);
  });

  it("currentStorageUsage reflects the most recent reading, not a sum", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordStorageUsage(1000);
    usage.recordStorageUsage(1500);
    expect(usage.currentStorageUsage()).toBe(1500);
  });

  it("currentStorageUsage returns 0 with no recordings", () => {
    expect(new KnowledgeUsageAnalytics().currentStorageUsage()).toBe(0);
  });

  it("tracks per-knowledge usage and totals", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordKnowledgeUsage("doc-1", 3);
    usage.recordKnowledgeUsage("doc-2", 2);
    usage.recordKnowledgeUsage("doc-1", 1);
    expect(usage.knowledgeUsage("doc-1")).toBe(4);
    expect(usage.knowledgeUsage("doc-2")).toBe(2);
    expect(usage.knowledgeUsageByKnowledge()).toEqual({ "doc-1": 4, "doc-2": 2 });
    expect(usage.totalKnowledgeUsage()).toBe(6);
  });

  it("returns 0 knowledgeUsage for an unknown id", () => {
    expect(new KnowledgeUsageAnalytics().knowledgeUsage("missing")).toBe(0);
  });

  it("tracks per-provider usage and totals", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordProviderUsage("openai", 10);
    usage.recordProviderUsage("anthropic", 5);
    expect(usage.providerUsage("openai")).toBe(10);
    expect(usage.providerUsageByProvider()).toEqual({ openai: 10, anthropic: 5 });
    expect(usage.totalProviderUsage()).toBe(15);
  });

  it("returns 0 providerUsage for an unknown id", () => {
    expect(new KnowledgeUsageAnalytics().providerUsage("missing")).toBe(0);
  });

  it("summary reports every owned metric", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordDocumentAdded(1);
    usage.recordDocumentIndexed(1);
    usage.recordDocumentDeleted(1);
    usage.recordStorageUsage(500);
    usage.recordKnowledgeUsage("k1", 2);
    usage.recordProviderUsage("p1", 3);
    expect(usage.summary()).toEqual({
      documentCount: 1,
      indexedCount: 1,
      deletedCount: 1,
      currentStorageUsage: 500,
      totalKnowledgeUsage: 2,
      totalProviderUsage: 3,
    });
  });
});
