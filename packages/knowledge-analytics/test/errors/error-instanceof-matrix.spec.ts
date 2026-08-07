import { describe, expect, it } from "vitest";

import { InvalidReportTypeException } from "../../src/errors/invalid-report-type-exception.js";
import { InvalidSampleException } from "../../src/errors/invalid-sample-exception.js";
import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";
import { MetricNotFoundException } from "../../src/errors/metric-not-found-exception.js";
import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";
import { ReportNotFoundException } from "../../src/errors/report-not-found-exception.js";

const subclasses: readonly (() => KnowledgeAnalyticsException)[] = [
  () => new InvalidReportTypeException("x"),
  () => new InvalidSampleException("x"),
  () => new MetricNotFoundException("x"),
  () => new PipelineStageFailureException("x", new Error("x")),
  () => new ReportNotFoundException("x"),
];

describe("KnowledgeAnalyticsException subclass matrix", () => {
  it.each(subclasses)(
    "every subclass is an instance of KnowledgeAnalyticsException and Error",
    (factory) => {
      const error = factory();
      expect(error).toBeInstanceOf(KnowledgeAnalyticsException);
      expect(error).toBeInstanceOf(Error);
    },
  );

  it.each(subclasses)("every subclass exposes a stable non-default code", (factory) => {
    const error = factory();
    expect(error.code).not.toBe("KNOWLEDGE_ANALYTICS_ERROR");
    expect(typeof error.code).toBe("string");
  });

  it.each(subclasses)("every subclass name matches its constructor name", (factory) => {
    const error = factory();
    expect(error.name).toBe(error.constructor.name);
  });
});
