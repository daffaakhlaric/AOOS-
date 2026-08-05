import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { KnowledgeSourceStatistics } from "../../src/statistics/knowledge-source-statistics.js";

describe("KnowledgeSourceStatistics additional coverage", () => {
  it("accumulates usageCount alongside registrationCount", () => {
    const statistics = new KnowledgeSourceStatistics();
    statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT, 3);
    statistics.recordRegistration(KnowledgeSourceCategory.DOCUMENT, 2);
    expect(statistics.get(KnowledgeSourceCategory.DOCUMENT)).toMatchObject({
      registrationCount: 2,
      usageCount: 5,
    });
  });

  it("returns the same EMPTY snapshot shape for every never-touched category", () => {
    const statistics = new KnowledgeSourceStatistics();
    expect(statistics.get(KnowledgeSourceCategory.ERP)).toEqual({
      registrationCount: 0,
      usageCount: 0,
    });
    expect(statistics.get(KnowledgeSourceCategory.CLOUD)).toEqual({
      registrationCount: 0,
      usageCount: 0,
    });
  });
});
