import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsEventType } from "../../src/events/knowledge-analytics-event-type.js";

describe("KnowledgeAnalyticsEventType", () => {
  it("defines exactly the 6 events from the specification", () => {
    expect(Object.keys(KnowledgeAnalyticsEventType)).toHaveLength(6);
  });

  it("uses the dotted knowledge.analytics namespace for every event", () => {
    for (const value of Object.values(KnowledgeAnalyticsEventType)) {
      expect(value.startsWith("knowledge.analytics.")).toBe(true);
    }
  });

  it("has the exact expected values", () => {
    expect(KnowledgeAnalyticsEventType.AnalyticsStarted).toBe("knowledge.analytics.started");
    expect(KnowledgeAnalyticsEventType.AnalyticsCompleted).toBe("knowledge.analytics.completed");
    expect(KnowledgeAnalyticsEventType.AnalyticsFailed).toBe("knowledge.analytics.failed");
    expect(KnowledgeAnalyticsEventType.MetricCalculated).toBe(
      "knowledge.analytics.metric.calculated",
    );
    expect(KnowledgeAnalyticsEventType.ReportGenerated).toBe(
      "knowledge.analytics.report.generated",
    );
    expect(KnowledgeAnalyticsEventType.DashboardUpdated).toBe(
      "knowledge.analytics.dashboard.updated",
    );
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeAnalyticsEventType);
    expect(new Set(values).size).toBe(values.length);
  });
});
