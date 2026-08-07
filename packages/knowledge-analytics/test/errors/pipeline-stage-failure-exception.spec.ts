import { describe, expect, it } from "vitest";

import { KnowledgeAnalyticsException } from "../../src/errors/knowledge-analytics-exception.js";
import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";

describe("PipelineStageFailureException", () => {
  it("is a KnowledgeAnalyticsException", () => {
    expect(new PipelineStageFailureException("CollectMetrics", new Error("boom"))).toBeInstanceOf(
      KnowledgeAnalyticsException,
    );
  });

  it("uses the PIPELINE_STAGE_FAILURE code", () => {
    expect(new PipelineStageFailureException("CollectMetrics", new Error("boom")).code).toBe(
      "PIPELINE_STAGE_FAILURE",
    );
  });

  it("includes the stage name in the message", () => {
    expect(
      new PipelineStageFailureException("CollectMetrics", new Error("boom")).message,
    ).toContain("CollectMetrics");
  });

  it("includes the stage name in context", () => {
    const error = new PipelineStageFailureException("CollectMetrics", new Error("boom"));
    expect(error.context).toEqual({ stageName: "CollectMetrics" });
  });

  it("stores the original error as the cause", () => {
    const cause = new Error("boom");
    const error = new PipelineStageFailureException("CollectMetrics", cause);
    expect(error.cause).toBe(cause);
  });

  it("stringifies a non-Error cause into the message", () => {
    const error = new PipelineStageFailureException("CollectMetrics", "plain string failure");
    expect(error.message).toContain("plain string failure");
  });
});
