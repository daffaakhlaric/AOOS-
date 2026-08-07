import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";
import { MetricNotFoundException } from "../../src/errors/metric-not-found-exception.js";

describe("MetricNotFoundException", () => {
  it("is a KnowledgeAnalyticsException", () => {
    expect(new MetricNotFoundException("hit_rate")).toBeInstanceOf(KnowledgeAnalyticsException);
  });

  it("uses the METRIC_NOT_FOUND code", () => {
    expect(new MetricNotFoundException("hit_rate").code).toBe("METRIC_NOT_FOUND");
  });

  it("includes the metric id in the message", () => {
    expect(new MetricNotFoundException("hit_rate").message).toContain("hit_rate");
  });

  it("includes the metric id in the context", () => {
    expect(new MetricNotFoundException("hit_rate").context).toEqual({ metricId: "hit_rate" });
  });

  it("has name MetricNotFoundException", () => {
    expect(new MetricNotFoundException("hit_rate").name).toBe("MetricNotFoundException");
  });
});
