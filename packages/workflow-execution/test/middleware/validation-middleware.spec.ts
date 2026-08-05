import { describe, expect, it, vi } from "vitest";

import { ExecutionValidationException } from "../../src/errors/execution-validation-exception.js";
import { ValidationMiddleware } from "../../src/middleware/validation-middleware.js";
import { ExecutionValidationPipeline } from "../../src/validator/execution-validation-pipeline.js";
import { brokenDefinitionFixture, definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Middleware Test — ValidationMiddleware", () => {
  it("calls next() when the session's graph is valid", async () => {
    const middleware = new ValidationMiddleware(new ExecutionValidationPipeline());
    const { session } = sessionFixture({ definition: definitionFixture() });
    const next = vi.fn(async () => {});

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws ExecutionValidationException when the session's graph is invalid", async () => {
    const middleware = new ValidationMiddleware(new ExecutionValidationPipeline());
    const { session } = sessionFixture({ definition: brokenDefinitionFixture() });
    const next = vi.fn(async () => {});

    await expect(
      middleware.execute({ session, operation: "start", metadata: {} }, next),
    ).rejects.toThrow(ExecutionValidationException);
    expect(next).not.toHaveBeenCalled();
  });
});
