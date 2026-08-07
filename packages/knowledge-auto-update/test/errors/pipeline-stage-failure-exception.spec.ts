import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";

describe("PipelineStageFailureException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new PipelineStageFailureException("stage", new Error("x"))).toBeInstanceOf(
      KnowledgeAutoUpdateException,
    );
  });

  it("sets code PIPELINE_STAGE_FAILURE", () => {
    expect(new PipelineStageFailureException("stage", new Error("x")).code).toBe(
      "PIPELINE_STAGE_FAILURE",
    );
  });

  it("includes the stage name and cause's message", () => {
    const cause = new Error("underlying failure");
    const error = new PipelineStageFailureException("detect-changes", cause);
    expect(error.message).toContain("detect-changes");
    expect(error.message).toContain("underlying failure");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ stageName: "detect-changes" });
  });

  it("stringifies a non-Error cause", () => {
    const error = new PipelineStageFailureException("stage", "plain string cause");
    expect(error.message).toContain("plain string cause");
  });
});
