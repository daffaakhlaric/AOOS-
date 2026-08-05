import { describe, expect, it, vi } from "vitest";

import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe("Middleware Test — LoggingMiddleware", () => {
  it("logs a starting and completed line on success", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);
    const next = vi.fn(async () => {});

    await middleware.execute(middlewareContextFixture(), next);

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[0]?.[1]).toBe("workflow-integration attempt starting");
    expect(logger.info.mock.calls[1]?.[1]).toBe("workflow-integration attempt completed");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an error line and rethrows when next() throws", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);

    await expect(
      middleware.execute(middlewareContextFixture(), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toBe("workflow-integration attempt failed");
  });
});
