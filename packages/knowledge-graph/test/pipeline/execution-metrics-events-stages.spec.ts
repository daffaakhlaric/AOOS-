import { describe, expect, it } from "vitest";

import { runEventsStage } from "../../src/pipeline/events-stage.js";
import { runExecutionStage } from "../../src/pipeline/execution-stage.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";
import { runMetricsStage } from "../../src/pipeline/metrics-stage.js";

function descriptor<T>(
  overrides: Partial<GraphOperationDescriptor<T>> = {},
): GraphOperationDescriptor<T> {
  return {
    operation: GraphOperationType.CreateNode,
    validate: () => undefined,
    execute: () => "result" as unknown as T,
    ...overrides,
  };
}

describe("runExecutionStage", () => {
  it("calls descriptor.execute() and returns its result", () => {
    const result = runExecutionStage(descriptor({ execute: () => 42 }));
    expect(result).toBe(42);
  });

  it("propagates a thrown error from descriptor.execute()", () => {
    expect(() =>
      runExecutionStage(
        descriptor({
          execute: () => {
            throw new Error("boom");
          },
        }),
      ),
    ).toThrow("boom");
  });
});

describe("runMetricsStage", () => {
  it("calls descriptor.recordMetrics(output) when supplied", () => {
    let received: unknown;
    runMetricsStage(descriptor({ recordMetrics: (output) => (received = output) }), "the-output");
    expect(received).toBe("the-output");
  });

  it("is a no-op when recordMetrics is not supplied", () => {
    expect(() => runMetricsStage(descriptor(), "the-output")).not.toThrow();
  });
});

describe("runEventsStage", () => {
  it("calls descriptor.emitEvents(output) when supplied", () => {
    let received: unknown;
    runEventsStage(descriptor({ emitEvents: (output) => (received = output) }), "the-output");
    expect(received).toBe("the-output");
  });

  it("is a no-op when emitEvents is not supplied", () => {
    expect(() => runEventsStage(descriptor(), "the-output")).not.toThrow();
  });
});
