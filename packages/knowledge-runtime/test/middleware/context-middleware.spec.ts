import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { ContextMiddleware } from "../../src/middleware/context-middleware.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — ContextMiddleware", () => {
  it("stamps metadata.contextSeenAt/correlationId and calls next()", async () => {
    const middleware = new ContextMiddleware();
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const context = { execution, operation: "load", metadata: {} as Record<string, unknown> };
    const next = vi.fn(async () => {});
    await middleware.execute(context, next);
    expect(context.metadata["contextSeenAt"]).toBeTruthy();
    expect(context.metadata["correlationId"]).toBe(execution.context.correlationId);
    expect(next).toHaveBeenCalledOnce();
  });
});
