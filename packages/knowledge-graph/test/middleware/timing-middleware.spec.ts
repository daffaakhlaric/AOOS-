import { describe, expect, it } from "vitest";

import { TimingMiddleware } from "../../src/middleware/timing-middleware.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

function descriptor(operation = GraphOperationType.CreateNode) {
  return {
    operation,
    validate: () => undefined,
    execute: () => undefined,
  } as GraphOperationDescriptor<unknown>;
}

describe("TimingMiddleware", () => {
  it("records a duration sample for a successful call", () => {
    const middleware = new TimingMiddleware();
    middleware.around(descriptor(), () => "ok");
    expect(middleware.sampleCount(GraphOperationType.CreateNode)).toBe(1);
    expect(middleware.averageDurationMs(GraphOperationType.CreateNode)).toBeGreaterThanOrEqual(0);
  });

  it("records a duration sample even when next() throws", () => {
    const middleware = new TimingMiddleware();
    expect(() =>
      middleware.around(descriptor(), () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(middleware.sampleCount(GraphOperationType.CreateNode)).toBe(1);
  });

  it("averages multiple samples for the same operation", () => {
    const middleware = new TimingMiddleware();
    middleware.around(descriptor(), () => "ok");
    middleware.around(descriptor(), () => "ok");
    expect(middleware.sampleCount(GraphOperationType.CreateNode)).toBe(2);
  });

  it("returns 0 average and 0 samples for an operation never recorded", () => {
    const middleware = new TimingMiddleware();
    expect(middleware.averageDurationMs(GraphOperationType.DeleteGraph)).toBe(0);
    expect(middleware.sampleCount(GraphOperationType.DeleteGraph)).toBe(0);
  });

  it("clear() resets all samples", () => {
    const middleware = new TimingMiddleware();
    middleware.around(descriptor(), () => "ok");
    middleware.clear();
    expect(middleware.sampleCount(GraphOperationType.CreateNode)).toBe(0);
  });

  it("keeps samples grouped separately by operation type", () => {
    const middleware = new TimingMiddleware();
    middleware.around(descriptor(GraphOperationType.CreateNode), () => "ok");
    middleware.around(descriptor(GraphOperationType.DeleteNode), () => "ok");
    expect(middleware.sampleCount(GraphOperationType.CreateNode)).toBe(1);
    expect(middleware.sampleCount(GraphOperationType.DeleteNode)).toBe(1);
  });
});
