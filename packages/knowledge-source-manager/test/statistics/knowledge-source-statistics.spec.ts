import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { KnowledgeSourceStatistics } from "../../src/statistics/knowledge-source-statistics.js";

describe("KnowledgeSourceStatistics", () => {
  it("returns an empty snapshot for an unregistered category", () => {
    const statistics = new KnowledgeSourceStatistics();
    expect(statistics.get(KnowledgeSourceCategory.DOCUMENT)).toEqual({
      registrationCount: 0,
      usageCount: 0,
    });
  });

  it("increments registrationCount per registration", () => {
    const statistics = new KnowledgeSourceStatistics();
    statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT);
    statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT);
    expect(statistics.get(KnowledgeSourceCategory.DOCUMENT).registrationCount).toBe(2);
  });

  it("tracks categories independently", () => {
    const statistics = new KnowledgeSourceStatistics();
    statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT);
    statistics.recordRegistration(KnowledgeSourceCategory.CRM);
    expect(statistics.get(KnowledgeSourceCategory.DOCUMENT).registrationCount).toBe(1);
    expect(statistics.get(KnowledgeSourceCategory.CRM).registrationCount).toBe(1);
  });

  it("stamps lastUsedAt on registration", () => {
    const statistics = new KnowledgeSourceStatistics();
    const snapshot = statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT);
    expect(snapshot.lastUsedAt).toBeTruthy();
  });
});
