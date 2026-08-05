import { describe, expect, it, vi } from "vitest";

import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe("Node Middleware Test — LoggingMiddleware", () => {
  it("logs a starting and completed line on success", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await middleware.execute(context, next);

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[0]?.[1]).toBe("node-runtime operation starting");
    expect(logger.info.mock.calls[1]?.[1]).toBe("node-runtime operation completed");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an error line and rethrows when next() throws", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);
    const next = vi.fn(async () => {
      throw new Error("boom");
    });
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await expect(middleware.execute(context, next)).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toBe("node-runtime operation failed");
  });
});
