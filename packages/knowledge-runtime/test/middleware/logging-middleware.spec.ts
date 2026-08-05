import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";

const factory = new KnowledgeRuntimeFactory();

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn() };
}

describe("Middleware Test — LoggingMiddleware", () => {
  it("logs starting/completed and calls next()", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledTimes(2);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs an error and rethrows when next() fails", async () => {
    const logger = fakeLogger();
    const middleware = new LoggingMiddleware(logger);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(
      middleware.execute({ execution, operation: "load", metadata: {} }, next),
    ).rejects.toThrow("boom");
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
