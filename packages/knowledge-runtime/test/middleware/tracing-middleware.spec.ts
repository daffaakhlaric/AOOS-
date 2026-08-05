import { InMemoryTracer } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { TracingMiddleware } from "../../src/middleware/tracing-middleware.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — TracingMiddleware", () => {
  it("wraps next() in a Span and stamps metadata.traceContext", async () => {
    const middleware = new TracingMiddleware(new InMemoryTracer());
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const context = { execution, operation: "load", metadata: {} as Record<string, unknown> };
    const next = vi.fn(async () => {});
    await middleware.execute(context, next);
    expect(next).toHaveBeenCalledOnce();
    expect(context.metadata["traceContext"]).toBeDefined();
  });

  it("still ends the Span and rethrows when next() fails", async () => {
    const middleware = new TracingMiddleware(new InMemoryTracer());
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const next = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(
      middleware.execute({ execution, operation: "load", metadata: {} }, next),
    ).rejects.toThrow("boom");
  });
});
