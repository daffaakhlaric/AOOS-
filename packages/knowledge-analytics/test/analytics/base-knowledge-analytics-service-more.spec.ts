import { describe, expect, it } from "vitest";

import { BaseKnowledgeAnalyticsService } from "../../src/analytics/base-knowledge-analytics-service.js";

class MultiMetricService extends BaseKnowledgeAnalyticsService {
  recordA(value: number): void {
    this.record("metric_a", value);
  }

  recordB(value: number): void {
    this.record("metric_b", value);
  }

  aValues(): number[] {
    return this.valuesFor("metric_a");
  }

  bValues(): number[] {
    return this.valuesFor("metric_b");
  }
}

describe("BaseKnowledgeAnalyticsService additional coverage", () => {
  it("tracks multiple distinct metric names independently within one service", () => {
    const service = new MultiMetricService();
    service.recordA(1);
    service.recordB(2);
    service.recordB(3);
    expect(service.aValues()).toEqual([1]);
    expect(service.bValues()).toEqual([2, 3]);
  });

  it("sampleCount sums across every distinct metric name", () => {
    const service = new MultiMetricService();
    service.recordA(1);
    service.recordA(2);
    service.recordB(3);
    expect(service.sampleCount()).toBe(3);
  });

  it("historyRetentionLimit applies independently per metric name", () => {
    const service = new MultiMetricService({ historyRetentionLimit: 1 });
    service.recordA(1);
    service.recordA(2);
    service.recordB(10);
    service.recordB(20);
    expect(service.aValues()).toEqual([2]);
    expect(service.bValues()).toEqual([20]);
  });

  it("reset clears all metric names, not just the first one recorded", () => {
    const service = new MultiMetricService();
    service.recordA(1);
    service.recordB(2);
    service.reset();
    expect(service.aValues()).toEqual([]);
    expect(service.bValues()).toEqual([]);
    expect(service.sampleCount()).toBe(0);
  });

  it("aggregateByTag returns an empty object when the metric has no samples", () => {
    class TaggedService extends BaseKnowledgeAnalyticsService {
      agg() {
        return this.aggregateByTag("nothing", "key");
      }
    }
    expect(new TaggedService().agg()).toEqual({});
  });
});
