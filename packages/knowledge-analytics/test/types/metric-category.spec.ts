import { describe, expect, it } from "vitest";

import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";

describe("KnowledgeMetricCategory", () => {
  it("defines exactly 11 categories, one per analytics service", () => {
    expect(Object.keys(KnowledgeMetricCategory)).toHaveLength(11);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeMetricCategory);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes Usage through Recommendation", () => {
    expect(KnowledgeMetricCategory.Usage).toBe("usage");
    expect(KnowledgeMetricCategory.Recommendation).toBe("recommendation");
  });
});
