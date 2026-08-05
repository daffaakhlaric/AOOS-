import { describe, expect, it, vi } from "vitest";

import { WorkflowValidationException } from "../../src/errors/workflow-validation-exception.js";
import type { RuntimeMiddlewareContext } from "../../src/middleware/i-runtime-middleware.js";
import { ValidationMiddleware } from "../../src/middleware/validation-middleware.js";
import type { RuntimeValidationResult } from "../../src/validator/i-workflow-runtime-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function fakeValidator(result: RuntimeValidationResult) {
  return { validate: vi.fn(() => result) };
}

describe("Runtime Middleware Test — ValidationMiddleware", () => {
  it("calls next() when validation passes", async () => {
    const middleware = new ValidationMiddleware(fakeValidator({ valid: true, issues: [] }));
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws WorkflowValidationException without calling next() when validation fails", async () => {
    const middleware = new ValidationMiddleware(
      fakeValidator({ valid: false, issues: [{ path: "nodes", message: "bad" }] }),
    );
    const next = vi.fn(async () => {});
    const context: RuntimeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await expect(middleware.execute(context, next)).rejects.toThrow(WorkflowValidationException);
    expect(next).not.toHaveBeenCalled();
  });
});
