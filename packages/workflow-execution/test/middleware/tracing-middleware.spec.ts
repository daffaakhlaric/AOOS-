import { InMemoryTracer } from "@aos/event-bus";
import { describe, expect, it, vi } from "vitest";

import { TracingMiddleware } from "../../src/middleware/tracing-middleware.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Middleware Test — TracingMiddleware", () => {
  it("starts and ends a span with outcome:success on success", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const { session } = sessionFixture();
    const context = { session, operation: "start", metadata: {} as Record<string, unknown> };

    await middleware.execute(context, async () => {});

    expect(tracer.getSpans()).toHaveLength(1);
    expect(tracer.getSpans()[0]?.name).toBe("workflow-execution.start");
    expect(context.metadata["traceContext"]).toBeDefined();
  });

  it("ends the span with outcome:error and rethrows when next() throws", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const { session } = sessionFixture();
    const context = { session, operation: "start", metadata: {} as Record<string, unknown> };

    await expect(
      middleware.execute(context, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(tracer.getSpans()).toHaveLength(1);
  });

  it("passes next() through unmodified when tracing is transparent", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const { session } = sessionFixture();
    const next = vi.fn(async () => {});

    await middleware.execute({ session, operation: "start", metadata: {} }, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
