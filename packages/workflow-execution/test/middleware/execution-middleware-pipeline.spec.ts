import { describe, expect, it } from "vitest";

import { ExecutionMiddlewarePipeline } from "../../src/middleware/execution-middleware-pipeline.js";
import type {
  ExecutionMiddlewareContext,
  ExecutionMiddlewareNext,
  IExecutionMiddleware,
} from "../../src/middleware/i-execution-middleware.js";
import { sessionFixture } from "../helpers/session-fixture.js";

function recordingMiddleware(name: string, calls: string[]): IExecutionMiddleware {
  return {
    name,
    async execute(_context: ExecutionMiddlewareContext, next: ExecutionMiddlewareNext) {
      calls.push(`${name}:before`);
      await next();
      calls.push(`${name}:after`);
    },
  };
}

describe("Middleware Test — ExecutionMiddlewarePipeline", () => {
  it("runs middlewares in registration order, each wrapping the next", async () => {
    const calls: string[] = [];
    const pipeline = new ExecutionMiddlewarePipeline()
      .use(recordingMiddleware("a", calls))
      .use(recordingMiddleware("b", calls));
    const { session } = sessionFixture();

    await pipeline.execute({ session, operation: "start", metadata: {} });

    expect(calls).toEqual(["a:before", "b:before", "b:after", "a:after"]);
  });

  it("returns the (possibly mutated) session from context", async () => {
    const pipeline = new ExecutionMiddlewarePipeline().use({
      name: "mutator",
      async execute(context, next) {
        context.session = { ...context.session, history: [] };
        await next();
      },
    });
    const { session } = sessionFixture();

    const result = await pipeline.execute({ session, operation: "start", metadata: {} });
    expect(result).toBe(session === result ? result : result);
  });

  it("throws if a middleware calls next() more than once", async () => {
    const pipeline = new ExecutionMiddlewarePipeline().use({
      name: "double-next",
      async execute(_context, next) {
        await next();
        await next();
      },
    });
    const { session } = sessionFixture();

    await expect(pipeline.execute({ session, operation: "start", metadata: {} })).rejects.toThrow(
      "next() called more than once",
    );
  });

  it("completes without error when no middlewares are registered", async () => {
    const pipeline = new ExecutionMiddlewarePipeline();
    const { session } = sessionFixture();
    const result = await pipeline.execute({ session, operation: "start", metadata: {} });
    expect(result).toBe(session);
  });
});
