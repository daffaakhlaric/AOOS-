import { describe, expect, it } from "vitest";

import { KnowledgePolicyMiddleware } from "../../src/middleware/knowledge-policy-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgePolicyMiddleware", () => {
  it("starts empty", () => {
    const middleware = new KnowledgePolicyMiddleware();
    expect(middleware.size).toBe(0);
  });

  it("use() adds a middleware and returns this for chaining", () => {
    const middleware = new KnowledgePolicyMiddleware();
    const result = middleware.use(() => undefined);
    expect(result).toBe(middleware);
    expect(middleware.size).toBe(1);
  });

  it("runs middlewares in registration order", async () => {
    const middleware = new KnowledgePolicyMiddleware();
    const order: number[] = [];
    middleware.use(async (_execution, next) => {
      order.push(1);
      await next();
      order.push(4);
    });
    middleware.use(async (_execution, next) => {
      order.push(2);
      await next();
      order.push(3);
    });
    await middleware.run(executionFixture());
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("passes the execution through to each middleware", async () => {
    const middleware = new KnowledgePolicyMiddleware();
    const execution = executionFixture();
    let seen: unknown;
    middleware.use((exec, next) => {
      seen = exec;
      return next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });

  it("supports a middleware that never calls next()", async () => {
    const middleware = new KnowledgePolicyMiddleware();
    let secondCalled = false;
    middleware.use(() => undefined);
    middleware.use(() => {
      secondCalled = true;
    });
    await middleware.run(executionFixture());
    expect(secondCalled).toBe(false);
  });

  it("throws when next() is called more than once", async () => {
    const middleware = new KnowledgePolicyMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow(
      "next() called multiple times in one Policy Middleware",
    );
  });

  it("runs with zero middlewares registered without error", async () => {
    const middleware = new KnowledgePolicyMiddleware();
    await expect(middleware.run(executionFixture())).resolves.toBeUndefined();
  });
});
