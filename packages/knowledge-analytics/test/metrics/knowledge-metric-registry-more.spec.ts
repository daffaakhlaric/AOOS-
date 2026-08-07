import { describe, expect, it } from "vitest";

import { KnowledgeMetricRegistry } from "../../src/metrics/knowledge-metric-registry.js";
import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

function definition(
  id: string,
  category: KnowledgeMetricCategory = KnowledgeMetricCategory.Usage,
): KnowledgeMetricDefinition {
  return new KnowledgeMetricDefinition({
    id,
    name: id,
    category,
    unit: KnowledgeMetricUnit.Count,
    description: "x",
  });
}

describe("KnowledgeMetricRegistry additional coverage", () => {
  it("re-registering the same id overwrites the definition and resets currentValue to 0", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    registry.updateValue("x", 99, 1);
    registry.register(definition("x", KnowledgeMetricCategory.Search));
    expect(registry.get("x").currentValue).toBe(0);
    expect(registry.get("x").definition.category).toBe(KnowledgeMetricCategory.Search);
  });

  it("supports registering and listing many metrics across categories", () => {
    const registry = new KnowledgeMetricRegistry();
    for (const category of Object.values(KnowledgeMetricCategory)) {
      registry.register(definition(`m_${category}`, category));
    }
    expect(registry.size()).toBe(Object.values(KnowledgeMetricCategory).length);
  });

  it("multiple updateValue calls overwrite the current value each time", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    registry.updateValue("x", 1, 1);
    registry.updateValue("x", 2, 2);
    registry.updateValue("x", 3, 3);
    expect(registry.get("x").currentValue).toBe(3);
    expect(registry.get("x").updatedAt).toBe(3);
  });

  it("isRegistered returns false after unregister", () => {
    const registry = new KnowledgeMetricRegistry();
    registry.register(definition("x"));
    registry.unregister("x");
    expect(registry.isRegistered("x")).toBe(false);
  });

  it("list() returns an empty array for a fresh registry", () => {
    expect(new KnowledgeMetricRegistry().list()).toEqual([]);
  });
});
