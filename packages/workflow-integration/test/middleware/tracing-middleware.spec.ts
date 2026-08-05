import { InMemoryTracer } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { TracingMiddleware } from "../../src/middleware/tracing-middleware.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — TracingMiddleware", () => {
  it("starts and ends a span with outcome:success on a successful result", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const mwContext = middlewareContextFixture();

    await middleware.execute(mwContext, async () => {
      mwContext.result = { success: true };
    });

    expect(tracer.getSpans()).toHaveLength(1);
    expect(tracer.getSpans()[0]?.name).toBe(`workflow-integration.${mwContext.namespace}`);
  });

  it("ends the span with outcome:unresolved when no result was set", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    await middleware.execute(middlewareContextFixture(), async () => {});
    expect(tracer.getSpans()).toHaveLength(1);
  });

  it("ends the span with outcome:error and rethrows when next() throws", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    await expect(
      middleware.execute(middlewareContextFixture(), async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(tracer.getSpans()).toHaveLength(1);
  });

  it("does not include tenantId in span attributes when the Context has none", async () => {
    const tracer = new InMemoryTracer();
    const middleware = new TracingMiddleware(tracer);
    const mwContext = middlewareContextFixture();
    await middleware.execute(mwContext, async () => {});
    expect(tracer.getSpans()[0]?.attributes.tenantId).toBeUndefined();
  });
});
