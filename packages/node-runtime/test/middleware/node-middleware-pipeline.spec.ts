import { describe, expect, it } from "vitest";

import type {
  INodeMiddleware,
  NodeMiddlewareContext,
} from "../../src/middleware/i-node-middleware.js";
import { NodeMiddlewarePipeline } from "../../src/middleware/node-middleware-pipeline.js";
import { executionFixture } from "../helpers/execution-fixture.js";

function recordingMiddleware(name: string, log: string[]): INodeMiddleware {
  return {
    name,
    async execute(_context, next) {
      log.push(`${name}:before`);
      await next();
      log.push(`${name}:after`);
    },
  };
}

describe("Node Middleware Test — NodeMiddlewarePipeline", () => {
  it("runs middlewares in registration order, each wrapping the next", async () => {
    const log: string[] = [];
    const pipeline = new NodeMiddlewarePipeline()
      .use(recordingMiddleware("a", log))
      .use(recordingMiddleware("b", log));
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "test",
      metadata: {},
    };
    await pipeline.execute(context);
    expect(log).toEqual(["a:before", "b:before", "b:after", "a:after"]);
  });

  it("returns context.execution as captured after the chain runs", async () => {
    const execution = executionFixture();
    const pipeline = new NodeMiddlewarePipeline().use({
      name: "mutator",
      async execute(context, next) {
        context.execution = {
          ...context.execution,
          instance: { ...context.execution.instance, metadata: { mutated: true } },
        };
        await next();
      },
    });
    const context: NodeMiddlewareContext = { execution, operation: "test", metadata: {} };
    const result = await pipeline.execute(context);
    expect(result.instance.metadata).toEqual({ mutated: true });
  });

  it("an empty pipeline returns the execution unchanged", async () => {
    const execution = executionFixture();
    const context: NodeMiddlewareContext = { execution, operation: "test", metadata: {} };
    const result = await new NodeMiddlewarePipeline().execute(context);
    expect(result).toBe(execution);
  });

  it("throws when a middleware calls next() more than once", async () => {
    const pipeline = new NodeMiddlewarePipeline().use({
      name: "double-next",
      async execute(_context, next) {
        await next();
        await next();
      },
    });
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "test",
      metadata: {},
    };
    await expect(pipeline.execute(context)).rejects.toThrow("next() called more than once");
  });

  it("propagates an error thrown by a middleware, short-circuiting the rest of the chain", async () => {
    const log: string[] = [];
    const pipeline = new NodeMiddlewarePipeline()
      .use({
        name: "thrower",
        async execute() {
          throw new Error("boom");
        },
      })
      .use(recordingMiddleware("never-reached", log));
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "test",
      metadata: {},
    };
    await expect(pipeline.execute(context)).rejects.toThrow("boom");
    expect(log).toEqual([]);
  });
});
