import { beforeEach, describe, expect, it } from "vitest";

import { KnowledgeUpdateResult } from "../../src/entities/knowledge-update-result.js";
import { ValidationFailedException } from "../../src/errors/validation-failed-exception.js";
import { ValidateResultStage } from "../../src/pipeline/stages/validate-result-stage.js";
import { resetFixtureState } from "../helpers/fixtures.js";
import { makeContext } from "../helpers/pipeline-helpers.js";

describe("ValidateResultStage", () => {
  beforeEach(resetFixtureState);

  it("passes through when context.result is absent", () => {
    const context = makeContext();
    expect(() => new ValidateResultStage().execute(context)).not.toThrow();
  });

  it("passes through for a well-formed successful result", () => {
    const context = makeContext();
    context.result = new KnowledgeUpdateResult({
      id: "r-1",
      taskId: "t-1",
      jobId: context.job.id,
      success: true,
      appliedPayload: { a: 1 },
      errorMessage: undefined,
      durationMs: 0,
      completedAt: 0,
    });
    expect(() => new ValidateResultStage().execute(context)).not.toThrow();
  });

  it("throws ValidationFailedException for an inconsistent result", () => {
    const context = makeContext();
    context.result = new KnowledgeUpdateResult({
      id: "r-1",
      taskId: "t-1",
      jobId: context.job.id,
      success: true,
      appliedPayload: undefined,
      errorMessage: undefined,
      durationMs: 0,
      completedAt: 0,
    });
    expect(() => new ValidateResultStage().execute(context)).toThrow(ValidationFailedException);
  });
});
