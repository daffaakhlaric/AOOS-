import { describe, expect, it } from "vitest";

import { InMemoryTracer } from "../../src/tracing/in-memory-tracer.js";
import { createChildSpan, createTraceContext } from "../../src/tracing/trace-context.js";

describe("Tracing Test — trace-context", () => {
  it("createTraceContext generates a traceId/spanId, using the given correlationId", () => {
    const context = createTraceContext("corr-1");
    expect(context.correlationId).toBe("corr-1");
    expect(context.traceId).toBeTruthy();
    expect(context.spanId).toBeTruthy();
    expect(context.parentSpanId).toBeUndefined();
  });

  it("createTraceContext generates a correlationId when none is given", () => {
    expect(createTraceContext().correlationId).toBeTruthy();
  });

  it("createChildSpan shares traceId/correlationId but gets a new spanId and parentSpanId", () => {
    const root = createTraceContext("corr-1");
    const child = createChildSpan(root);
    expect(child.traceId).toBe(root.traceId);
    expect(child.correlationId).toBe(root.correlationId);
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.spanId).not.toBe(root.spanId);
  });
});

describe("Tracing Test — InMemoryTracer", () => {
  it("records a started span with its name/context/attributes", () => {
    const tracer = new InMemoryTracer();
    const context = createTraceContext("corr-1");
    tracer.startSpan("publish:agent.created", context, { foo: "bar" });
    const spans = tracer.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe("publish:agent.created");
    expect(spans[0]?.attributes).toEqual({ foo: "bar" });
    expect(spans[0]?.endedAt).toBeUndefined();
  });

  it("setAttribute and end() update the recorded span", () => {
    const tracer = new InMemoryTracer();
    const span = tracer.startSpan("deliver", createTraceContext());
    span.setAttribute("subscriberId", "s-1");
    span.end({ delivered: true });
    const [recorded] = tracer.getSpans();
    expect(recorded?.attributes).toEqual({ subscriberId: "s-1", delivered: true });
    expect(recorded?.endedAt).toBeDefined();
  });

  it("clear() empties recorded spans", () => {
    const tracer = new InMemoryTracer();
    tracer.startSpan("x", createTraceContext());
    tracer.clear();
    expect(tracer.getSpans()).toHaveLength(0);
  });
});
