import { describe, expect, it } from "vitest";

import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

describe("KnowledgeMetricDefinition", () => {
  it("stores every constructor property", () => {
    const definition = new KnowledgeMetricDefinition({
      id: "hit_rate",
      name: "Hit Rate",
      category: KnowledgeMetricCategory.Search,
      unit: KnowledgeMetricUnit.Ratio,
      description: "The search hit rate.",
    });
    expect(definition.id).toBe("hit_rate");
    expect(definition.name).toBe("Hit Rate");
    expect(definition.category).toBe(KnowledgeMetricCategory.Search);
    expect(definition.unit).toBe(KnowledgeMetricUnit.Ratio);
    expect(definition.description).toBe("The search hit rate.");
  });

  it("is frozen (immutable)", () => {
    const definition = new KnowledgeMetricDefinition({
      id: "x",
      name: "x",
      category: KnowledgeMetricCategory.Usage,
      unit: KnowledgeMetricUnit.Count,
      description: "x",
    });
    expect(Object.isFrozen(definition)).toBe(true);
  });
});
