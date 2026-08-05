import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderStatistics } from "../../src/statistics/knowledge-provider-statistics.js";

describe("KnowledgeProviderStatistics", () => {
  it("returns an empty snapshot for a category never registered", () => {
    const statistics = new KnowledgeProviderStatistics();
    expect(statistics.get(KnowledgeProviderCategory.DOCUMENT)).toEqual({
      registrationCount: 0,
      usageCount: 0,
    });
  });

  it("accumulates registrationCount/usageCount across recordRegistration() calls", () => {
    const statistics = new KnowledgeProviderStatistics();
    statistics.recordRegistration(KnowledgeProviderCategory.DOCUMENT, 3);
    statistics.recordRegistration(KnowledgeProviderCategory.DOCUMENT, 2);
    const snapshot = statistics.get(KnowledgeProviderCategory.DOCUMENT);
    expect(snapshot.registrationCount).toBe(2);
    expect(snapshot.usageCount).toBe(5);
    expect(snapshot.lastUsedAt).toBeDefined();
  });

  it("tracks each Category independently", () => {
    const statistics = new KnowledgeProviderStatistics();
    statistics.recordRegistration(KnowledgeProviderCategory.DOCUMENT, 1);
    statistics.recordRegistration(KnowledgeProviderCategory.DATABASE, 5);
    expect(statistics.get(KnowledgeProviderCategory.DOCUMENT).usageCount).toBe(1);
    expect(statistics.get(KnowledgeProviderCategory.DATABASE).usageCount).toBe(5);
  });

  it("defaults usageCount to 0 when omitted", () => {
    const statistics = new KnowledgeProviderStatistics();
    statistics.recordRegistration(KnowledgeProviderCategory.DOCUMENT);
    expect(statistics.get(KnowledgeProviderCategory.DOCUMENT).usageCount).toBe(0);
  });
});
