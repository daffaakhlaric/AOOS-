import { describe, expect, it } from "vitest";

import { LoggingMiddleware } from "../../src/middleware/logging-middleware.js";
import type { GraphOperationDescriptor } from "../../src/pipeline/graph-operation-descriptor.js";
import { GraphOperationType } from "../../src/pipeline/graph-operation-type.js";

function descriptor(overrides: Partial<GraphOperationDescriptor<unknown>> = {}) {
  return {
    operation: GraphOperationType.CreateNode,
    actor: "alice",
    graphId: "g1",
    validate: () => undefined,
    execute: () => undefined,
    ...overrides,
  } as GraphOperationDescriptor<unknown>;
}

describe("LoggingMiddleware", () => {
  it("records a success entry when next() succeeds", () => {
    const middleware = new LoggingMiddleware();
    middleware.around(descriptor(), () => "ok");
    const log = middleware.getLog();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      operation: GraphOperationType.CreateNode,
      actor: "alice",
      graphId: "g1",
      outcome: "success",
    });
  });

  it("records a failure entry and re-throws when next() throws", () => {
    const middleware = new LoggingMiddleware();
    expect(() =>
      middleware.around(descriptor(), () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    const log = middleware.getLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.outcome).toBe("failure");
    expect(log[0]?.errorMessage).toBe("boom");
  });

  it("records a stringified message for a non-Error throw", () => {
    const middleware = new LoggingMiddleware();
    expect(() =>
      middleware.around(descriptor(), () => {
        throw "raw-string-error";
      }),
    ).toThrow();
    expect(middleware.getLog()[0]?.errorMessage).toBe("raw-string-error");
  });

  it("clear() empties the log", () => {
    const middleware = new LoggingMiddleware();
    middleware.around(descriptor(), () => "ok");
    middleware.clear();
    expect(middleware.getLog()).toHaveLength(0);
  });
});
