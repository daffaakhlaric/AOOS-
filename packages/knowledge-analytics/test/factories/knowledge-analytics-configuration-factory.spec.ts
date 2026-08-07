import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsConfigurationFactory } from "../../src/factories/knowledge-analytics-configuration-factory.js";

describe("KnowledgeAnalyticsConfigurationFactory", () => {
  it("createDefault returns the default configuration", () => {
    const config = new KnowledgeAnalyticsConfigurationFactory().createDefault();
    expect(config.percentileThresholds).toEqual([95, 99]);
    expect(config.dashboardRefreshCadenceMs).toBe(60_000);
  });

  it("create passes props through to the configuration", () => {
    const config = new KnowledgeAnalyticsConfigurationFactory().create({
      historyRetentionLimit: 5,
    });
    expect(config.historyRetentionLimit).toBe(5);
  });

  it("createFastRefresh returns a fast-refresh configuration", () => {
    const config = new KnowledgeAnalyticsConfigurationFactory().createFastRefresh();
    expect(config.dashboardRefreshCadenceMs).toBe(1_000);
    expect(config.trendBucketSizeMs).toBe(60_000);
  });
});
