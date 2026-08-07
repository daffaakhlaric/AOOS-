import { describe, expect, it } from "vitest";

import { KnowledgeVersionMiddleware } from "../../src/middleware/knowledge-version-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeVersionMiddleware", () => {
  it("runs middlewares in registration order", async () => {
    const middleware = new KnowledgeVersionMiddleware();
    const order: string[] = [];
    middleware.use(async (_execution, next) => {
      order.push("a-before");
      await next();
      order.push("a-after");
    });
    middleware.use(async (_execution, next) => {
      order.push("b");
      await next();
    });
    await middleware.run(executionFixture());
    expect(order).toEqual(["a-before", "b", "a-after"]);
  });

  it("use() returns this for chaining", () => {
    const middleware = new KnowledgeVersionMiddleware();
    const result = middleware.use(async () => {});
    expect(result).toBe(middleware);
  });

  it("size reflects the number of registered middlewares", () => {
    const middleware = new KnowledgeVersionMiddleware();
    expect(middleware.size).toBe(0);
    middleware.use(async () => {});
    expect(middleware.size).toBe(1);
  });

  it("runs with no middlewares registered", async () => {
    const middleware = new KnowledgeVersionMiddleware();
    await expect(middleware.run(executionFixture())).resolves.toBeUndefined();
  });

  it("a middleware that never calls next() halts the chain", async () => {
    const middleware = new KnowledgeVersionMiddleware();
    let secondCalled = false;
    middleware.use(async () => {});
    middleware.use(async () => {
      secondCalled = true;
    });
    await middleware.run(executionFixture());
    expect(secondCalled).toBe(false);
  });

  it("rejects a middleware calling next() twice", async () => {
    const middleware = new KnowledgeVersionMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow(
      "next() called multiple times in one Version Middleware",
    );
  });

  it("passes the execution through to each middleware", async () => {
    const middleware = new KnowledgeVersionMiddleware();
    const execution = executionFixture();
    let seen: unknown;
    middleware.use((exec, next) => {
      seen = exec;
      return next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });
});
