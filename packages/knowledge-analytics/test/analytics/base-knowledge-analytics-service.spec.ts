import { describe, expect, it } from "vitest";

import { BaseKnowledgeAnalyticsService } from "../../src/analytics/base-knowledge-analytics-service.js";
import { KnowledgeMetricRegistry } from "../../src/metrics/knowledge-metric-registry.js";
import { KnowledgeMetricUnit } from "../../src/types/common.js";
import { KnowledgeMetricCategory } from "../../src/types/metric-category.js";
import { createFixedClock } from "../../src/utils/clock.js";
import { KnowledgeMetricDefinition } from "../../src/value-objects/knowledge-metric-definition.js";

class TestAnalyticsService extends BaseKnowledgeAnalyticsService {
  recordValue(value: number, tags: Record<string, string> = {}): void {
    this.record("test_metric", value, tags);
  }

  values(): number[] {
    return this.valuesFor("test_metric");
  }

  samples() {
    return this.samplesFor("test_metric");
  }

  aggregate(tagKey: string) {
    return this.aggregateByTag("test_metric", tagKey);
  }

  publishTestMetric(value: number): void {
    this.publish("test_metric", value);
  }
}

describe("BaseKnowledgeAnalyticsService", () => {
  it("stores recorded samples and returns their values via valuesFor", () => {
    const service = new TestAnalyticsService();
    service.recordValue(1);
    service.recordValue(2);
    expect(service.values()).toEqual([1, 2]);
  });

  it("returns an empty array for a metric with no recorded samples", () => {
    const service = new TestAnalyticsService();
    expect(service.values()).toEqual([]);
  });

  it("uses the injected clock for sample timestamps", () => {
    const service = new TestAnalyticsService({ clock: createFixedClock(999) });
    service.recordValue(1);
    expect(service.samples()[0]!.timestamp).toBe(999);
  });

  it("attaches tags to recorded samples", () => {
    const service = new TestAnalyticsService();
    service.recordValue(1, { provider: "openai" });
    expect(service.samples()[0]!.tags).toEqual({ provider: "openai" });
  });

  it("evicts the oldest samples once historyRetentionLimit is exceeded", () => {
    const service = new TestAnalyticsService({ historyRetentionLimit: 2 });
    service.recordValue(1);
    service.recordValue(2);
    service.recordValue(3);
    expect(service.values()).toEqual([2, 3]);
  });

  it("does not evict when historyRetentionLimit is 0 (unbounded)", () => {
    const service = new TestAnalyticsService({ historyRetentionLimit: 0 });
    for (let i = 0; i < 10; i += 1) service.recordValue(i);
    expect(service.values()).toHaveLength(10);
  });

  it("aggregateByTag groups and sums values by tag", () => {
    const service = new TestAnalyticsService();
    service.recordValue(3, { key: "a" });
    service.recordValue(4, { key: "a" });
    service.recordValue(5, { key: "b" });
    expect(service.aggregate("key")).toEqual({ a: 7, b: 5 });
  });

  it("aggregateByTag ignores samples missing the tag key", () => {
    const service = new TestAnalyticsService();
    service.recordValue(3, { key: "a" });
    service.recordValue(4);
    expect(service.aggregate("key")).toEqual({ a: 3 });
  });

  it("sampleCount sums samples across every metric this service owns", () => {
    const service = new TestAnalyticsService();
    service.recordValue(1);
    service.recordValue(2);
    expect(service.sampleCount()).toBe(2);
  });

  it("reset clears every recorded sample", () => {
    const service = new TestAnalyticsService();
    service.recordValue(1);
    service.reset();
    expect(service.sampleCount()).toBe(0);
    expect(service.values()).toEqual([]);
  });

  describe("publish", () => {
    it("updates the registry when the metric is registered", () => {
      const registry = new KnowledgeMetricRegistry();
      registry.register(
        new KnowledgeMetricDefinition({
          id: "test_metric",
          name: "test_metric",
          category: KnowledgeMetricCategory.Usage,
          unit: KnowledgeMetricUnit.Count,
          description: "test",
        }),
      );
      const service = new TestAnalyticsService({ registry });
      service.publishTestMetric(42);
      expect(registry.get("test_metric").currentValue).toBe(42);
    });

    it("is a no-op when no registry was supplied", () => {
      const service = new TestAnalyticsService();
      expect(() => service.publishTestMetric(42)).not.toThrow();
    });

    it("is a no-op when the metric is not registered", () => {
      const registry = new KnowledgeMetricRegistry();
      const service = new TestAnalyticsService({ registry });
      expect(() => service.publishTestMetric(42)).not.toThrow();
    });
  });
});
