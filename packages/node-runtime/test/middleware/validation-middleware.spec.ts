import { describe, expect, it, vi } from "vitest";

import { NodeValidationException } from "../../src/errors/node-validation-exception.js";
import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { ValidationMiddleware } from "../../src/middleware/validation-middleware.js";
import type { NodeValidationResult } from "../../src/validator/i-node-validator.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function fakePipeline(result: NodeValidationResult) {
  return { run: vi.fn(() => result) };
}

describe("Node Middleware Test — ValidationMiddleware", () => {
  it("calls next() when validation passes", async () => {
    const middleware = new ValidationMiddleware(fakePipeline({ valid: true, issues: [] }) as never);
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws NodeValidationException without calling next() when validation fails", async () => {
    const middleware = new ValidationMiddleware(
      fakePipeline({ valid: false, issues: [{ path: "config", message: "bad" }] }) as never,
    );
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };
    await expect(middleware.execute(context, next)).rejects.toThrow(NodeValidationException);
    expect(next).not.toHaveBeenCalled();
  });
});
