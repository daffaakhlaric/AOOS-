import { describe, expect, it } from "vitest";

import { EmbeddingMiddleware } from "../../src/middleware/embedding-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingMiddleware", () => {
  it("size starts at 0", () => {
    expect(new EmbeddingMiddleware().size).toBe(0);
  });

  it("use() registers a middleware and increments size", () => {
    const middleware = new EmbeddingMiddleware();
    middleware.use(async (_execution, next) => next());
    expect(middleware.size).toBe(1);
  });

  it("run() invokes registered middlewares in order", async () => {
    const middleware = new EmbeddingMiddleware();
    const order: number[] = [];
    middleware.use(async (_execution, next) => {
      order.push(1);
      await next();
    });
    middleware.use(async (_execution, next) => {
      order.push(2);
      await next();
    });
    await middleware.run(executionFixture());
    expect(order).toEqual([1, 2]);
  });

  it("run() with no middlewares resolves without error", async () => {
    const middleware = new EmbeddingMiddleware();
    await expect(middleware.run(executionFixture())).resolves.toBeUndefined();
  });

  it("run() supports a middleware that never calls next()", async () => {
    const middleware = new EmbeddingMiddleware();
    let secondCalled = false;
    middleware.use(async () => {
      /* stop the chain */
    });
    middleware.use(async () => {
      secondCalled = true;
    });
    await middleware.run(executionFixture());
    expect(secondCalled).toBe(false);
  });

  it("run() throws when next() is called twice", async () => {
    const middleware = new EmbeddingMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow(
      /next\(\) called multiple times/,
    );
  });

  it("run() passes the execution through to each middleware", async () => {
    const middleware = new EmbeddingMiddleware();
    const execution = executionFixture();
    let seen: unknown;
    middleware.use(async (exec, next) => {
      seen = exec;
      await next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });

  it("run() supports async middleware ordering with awaited work", async () => {
    const middleware = new EmbeddingMiddleware();
    const order: number[] = [];
    middleware.use(async (_execution, next) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      order.push(1);
      await next();
    });
    middleware.use(async (_execution, next) => {
      order.push(2);
      await next();
    });
    await middleware.run(executionFixture());
    expect(order).toEqual([1, 2]);
  });
});
