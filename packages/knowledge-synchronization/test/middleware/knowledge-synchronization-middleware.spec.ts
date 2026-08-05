import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationMiddlewarePipeline } from "../../src/middleware/knowledge-synchronization-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSynchronizationMiddlewarePipeline", () => {
  it("runs middlewares in registration order", async () => {
    const order: string[] = [];
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    pipeline.use(async (_execution, next) => {
      order.push("a");
      await next();
    });
    pipeline.use(async (_execution, next) => {
      order.push("b");
      await next();
    });
    await pipeline.run(executionFixture());
    expect(order).toEqual(["a", "b"]);
  });

  it("passes the execution through to each middleware", async () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    const execution = executionFixture();
    let seen: unknown;
    pipeline.use((exec, next) => {
      seen = exec;
      return next();
    });
    await pipeline.run(execution);
    expect(seen).toBe(execution);
  });

  it("stops the chain when a middleware does not call next()", async () => {
    const order: string[] = [];
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    pipeline.use(() => {
      order.push("a");
    });
    pipeline.use(async (_execution, next) => {
      order.push("b");
      await next();
    });
    await pipeline.run(executionFixture());
    expect(order).toEqual(["a"]);
  });

  it("propagates an error thrown by a middleware", async () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    pipeline.use(() => {
      throw new Error("boom");
    });
    await expect(pipeline.run(executionFixture())).rejects.toThrow("boom");
  });

  it("throws when next() is called more than once", async () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    pipeline.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(pipeline.run(executionFixture())).rejects.toThrow("next() called multiple times");
  });

  it("use() returns this for chaining", () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    expect(pipeline.use(() => undefined)).toBe(pipeline);
  });

  it("size reflects the number of registered middlewares", () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    expect(pipeline.size).toBe(0);
    pipeline.use(() => undefined);
    expect(pipeline.size).toBe(1);
  });

  it("run() resolves without error when no middleware is registered", async () => {
    const pipeline = new KnowledgeSynchronizationMiddlewarePipeline();
    await expect(pipeline.run(executionFixture())).resolves.toBeUndefined();
  });
});
