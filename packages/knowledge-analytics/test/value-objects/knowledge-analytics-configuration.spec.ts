import { describe, expect, it } from "vitest";

import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { KnowledgeAnalyticsConfiguration } from "../../src/value-objects/knowledge-analytics-configuration.js";

describe("KnowledgeAnalyticsConfiguration", () => {
  it("applies default percentile thresholds [95, 99]", () => {
    expect(new KnowledgeAnalyticsConfiguration().percentileThresholds).toEqual([95, 99]);
  });

  it("applies a default dashboard refresh cadence of 60000ms", () => {
    expect(new KnowledgeAnalyticsConfiguration().dashboardRefreshCadenceMs).toBe(60_000);
  });

  it("applies a default trend bucket size of 3600000ms", () => {
    expect(new KnowledgeAnalyticsConfiguration().trendBucketSizeMs).toBe(3_600_000);
  });

  it("applies a default history retention limit of 0 (unbounded)", () => {
    expect(new KnowledgeAnalyticsConfiguration().historyRetentionLimit).toBe(0);
  });

  it("accepts custom percentile thresholds", () => {
    const config = new KnowledgeAnalyticsConfiguration({ percentileThresholds: [50, 90] });
    expect(config.percentileThresholds).toEqual([50, 90]);
  });

  it("accepts custom dashboardRefreshCadenceMs", () => {
    expect(
      new KnowledgeAnalyticsConfiguration({ dashboardRefreshCadenceMs: 5000 })
        .dashboardRefreshCadenceMs,
    ).toBe(5000);
  });

  it("accepts custom trendBucketSizeMs", () => {
    expect(new KnowledgeAnalyticsConfiguration({ trendBucketSizeMs: 1000 }).trendBucketSizeMs).toBe(
      1000,
    );
  });

  it("accepts custom historyRetentionLimit", () => {
    expect(
      new KnowledgeAnalyticsConfiguration({ historyRetentionLimit: 10 }).historyRetentionLimit,
    ).toBe(10);
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(new KnowledgeAnalyticsConfiguration())).toBe(true);
  });

  it("freezes percentileThresholds", () => {
    expect(Object.isFrozen(new KnowledgeAnalyticsConfiguration().percentileThresholds)).toBe(true);
  });

  it("throws for a percentile threshold below 0", () => {
    expect(() => new KnowledgeAnalyticsConfiguration({ percentileThresholds: [-1] })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws for a percentile threshold above 100", () => {
    expect(() => new KnowledgeAnalyticsConfiguration({ percentileThresholds: [101] })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws for a non-positive dashboardRefreshCadenceMs", () => {
    expect(() => new KnowledgeAnalyticsConfiguration({ dashboardRefreshCadenceMs: 0 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws for a non-positive trendBucketSizeMs", () => {
    expect(() => new KnowledgeAnalyticsConfiguration({ trendBucketSizeMs: -1 })).toThrow(
      InvalidSampleException,
    );
  });

  it("throws for a negative historyRetentionLimit", () => {
    expect(() => new KnowledgeAnalyticsConfiguration({ historyRetentionLimit: -1 })).toThrow(
      InvalidSampleException,
    );
  });

  describe("with", () => {
    it("returns a new instance with overrides applied", () => {
      const base = new KnowledgeAnalyticsConfiguration();
      const updated = base.with({ dashboardRefreshCadenceMs: 5000 });
      expect(updated.dashboardRefreshCadenceMs).toBe(5000);
      expect(updated.trendBucketSizeMs).toBe(base.trendBucketSizeMs);
    });

    it("does not mutate the original instance", () => {
      const base = new KnowledgeAnalyticsConfiguration();
      base.with({ dashboardRefreshCadenceMs: 5000 });
      expect(base.dashboardRefreshCadenceMs).toBe(60_000);
    });

    it("preserves every field not overridden", () => {
      const base = new KnowledgeAnalyticsConfiguration({ percentileThresholds: [50] });
      const updated = base.with({ historyRetentionLimit: 3 });
      expect(updated.percentileThresholds).toEqual([50]);
      expect(updated.historyRetentionLimit).toBe(3);
    });
  });
});
