import { describe, expect, it } from "vitest";

import { KnowledgeUsageAnalytics } from "../../src/analytics/knowledge-usage-analytics.js";

describe("KnowledgeUsageAnalytics edge cases", () => {
  it("supports many distinct knowledge ids without cross-contamination", () => {
    const usage = new KnowledgeUsageAnalytics();
    for (let i = 0; i < 20; i += 1) usage.recordKnowledgeUsage(`k${i}`, i + 1);
    expect(usage.knowledgeUsage("k5")).toBe(6);
    expect(usage.knowledgeUsage("k19")).toBe(20);
    expect(Object.keys(usage.knowledgeUsageByKnowledge())).toHaveLength(20);
  });

  it("supports many distinct provider ids without cross-contamination", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordProviderUsage("openai", 5);
    usage.recordProviderUsage("anthropic", 3);
    usage.recordProviderUsage("cohere", 1);
    expect(usage.providerUsageByProvider()).toEqual({ openai: 5, anthropic: 3, cohere: 1 });
  });

  it("storage usage gauge can decrease (reflects the latest reading only)", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordStorageUsage(1000);
    usage.recordStorageUsage(500);
    expect(usage.currentStorageUsage()).toBe(500);
  });

  it("default recordDocumentAdded/Indexed/Deleted count is 1", () => {
    const usage = new KnowledgeUsageAnalytics();
    usage.recordDocumentAdded();
    usage.recordDocumentIndexed();
    usage.recordDocumentDeleted();
    expect(usage.documentCount()).toBe(1);
    expect(usage.indexedCount()).toBe(1);
    expect(usage.deletedCount()).toBe(1);
  });

  it("accumulates large counts correctly over many calls", () => {
    const usage = new KnowledgeUsageAnalytics();
    for (let i = 0; i < 1000; i += 1) usage.recordDocumentAdded(1);
    expect(usage.documentCount()).toBe(1000);
  });
});
