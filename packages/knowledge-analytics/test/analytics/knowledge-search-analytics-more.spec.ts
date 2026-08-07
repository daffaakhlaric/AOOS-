import { describe, expect, it } from "vitest";

import { KnowledgeSearchAnalytics } from "../../src/analytics/knowledge-search-analytics.js";
import { KnowledgeMetricRegistry } from "../../src/metrics/knowledge-metric-registry.js";
import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { KnowledgeMetricName } from "../../src/types/metric-name.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

describe("KnowledgeSearchAnalytics edge cases", () => {
  it("reports missRate 1 and hitRate 0 when every search misses", () => {
    const search = new KnowledgeSearchAnalytics();
    search.recordSearch({ hit: false });
    search.recordSearch({ hit: false });
    expect(search.hitRate()).toBe(0);
    expect(search.missRate()).toBe(1);
  });

  it("publishes SearchCount, HitRate, and MissRate to the registry on every record", () => {
    const registry = new KnowledgeMetricRegistry();
    for (const id of [
      KnowledgeMetricName.SearchCount,
      KnowledgeMetricName.HitRate,
      KnowledgeMetricName.MissRate,
    ]) {
      registry.register(
        new KnowledgeMetricDefinition({
          id,
          name: id,
          category: KnowledgeMetricCategory.Search,
          unit: KnowledgeMetricUnit.Count,
          description: "x",
        }),
      );
    }
    const search = new KnowledgeSearchAnalytics({ registry });
    search.recordSearch({ hit: true });
    expect(registry.get(KnowledgeMetricName.SearchCount).currentValue).toBe(1);
    expect(registry.get(KnowledgeMetricName.HitRate).currentValue).toBe(1);
    expect(registry.get(KnowledgeMetricName.MissRate).currentValue).toBe(0);
  });

  it("handles a long alternating sequence correctly", () => {
    const search = new KnowledgeSearchAnalytics();
    for (let i = 0; i < 200; i += 1) search.recordSearch({ hit: i % 2 === 0 });
    expect(search.searchCount()).toBe(200);
    expect(search.hitRate()).toBe(0.5);
  });
});
