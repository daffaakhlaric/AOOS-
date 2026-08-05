import { InMemoryTracer } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { TracingMiddleware } from "../../src/middleware/tracing-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Middleware Test — TracingMiddleware", () => {
  it("starts a span, calls next(), and ends the span on success", async () => {
    const tracer = new InMemoryTracer();
    const startSpanSpy = vi.spyOn(tracer, "startSpan");
    const middleware = new TracingMiddleware(tracer);
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await middleware.execute(context, next);

    expect(startSpanSpy).toHaveBeenCalledTimes(1);
    expect(startSpanSpy.mock.calls[0]?.[0]).toBe("node-runtime.start");
    expect(next).toHaveBeenCalledTimes(1);
    expect(context.metadata["traceContext"]).toBeDefined();
  });

  it("still ends the span and rethrows when next() throws", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const next = vi.fn(async () => {
      throw new Error("boom");
    });
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await expect(middleware.execute(context, next)).rejects.toThrow("boom");
  });
});
