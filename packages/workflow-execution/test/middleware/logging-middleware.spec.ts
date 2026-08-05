import { describe, expect, it, vi } from "vitest";

import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";
import { sessionFixture } from "../helpers/session-fixture.js";

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe("Middleware Test — LoggingMiddleware", () => {
  it("logs a starting and completed line on success", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);
    const next = vi.fn(async () => {});
    const { session } = sessionFixture();

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.info.mock.calls[0]?.[1]).toBe("workflow-execution operation starting");
    expect(logger.info.mock.calls[1]?.[1]).toBe("workflow-execution operation completed");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an error line and rethrows when next() throws", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger as never);
    const { session } = sessionFixture();

    await expect(
      middleware.execute({ session, operation: "start", metadata: {} }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toBe("workflow-execution operation failed");
  });
});
