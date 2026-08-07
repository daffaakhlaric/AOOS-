import { describe, expect, it } from "vitest";

import { KnowledgeIntelligenceException } from "../../src/errors/knowledge-intelligence-exception.js";
import { PipelineStageFailureException } from "../../src/errors/pipeline-stage-failure-exception.js";

describe("PipelineStageFailureException", () => {
  it("carries the stage name, cause, and a stable code", () => {
    const cause = new Error("stage boom");
    const error = new PipelineStageFailureException("analyze-quality", cause);
    expect(error.code).toBe("PIPELINE_STAGE_FAILURE");
    expect(error.context).toEqual({ stageName: "analyze-quality" });
    expect(error.cause).toBe(cause);
  });

  it("is a KnowledgeIntelligenceException", () => {
    expect(new PipelineStageFailureException("x", undefined)).toBeInstanceOf(
      KnowledgeIntelligenceException,
    );
  });
});
