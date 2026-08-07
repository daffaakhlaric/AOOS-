import { describe, expect, it } from "vitest";

import { EmbeddingMiddleware } from "../../src/middleware/embedding-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("EmbeddingMiddleware — extra ordering/chaining scenarios", () => {
  it("use() is chainable (returns this)", () => {
    const middleware = new EmbeddingMiddleware();
    const returned = middleware.use(async (_e, next) => next());
    expect(returned).toBe(middleware);
  });

  it("supports 10 chained middlewares all invoked in order", async () => {
    const middleware = new EmbeddingMiddleware();
    const order: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      middleware.use(async (_e, next) => {
        order.push(i);
        await next();
      });
    }
    await middleware.run(executionFixture());
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(middleware.size).toBe(10);
  });

  it("a synchronous (non-async) middleware function is supported", async () => {
    const middleware = new EmbeddingMiddleware();
    let called = false;
    middleware.use((_execution, next) => {
      called = true;
      return next();
    });
    await middleware.run(executionFixture());
    expect(called).toBe(true);
  });

  it("an error thrown inside a middleware propagates out of run()", async () => {
    const middleware = new EmbeddingMiddleware();
    middleware.use(async () => {
      throw new Error("boom");
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow("boom");
  });

  it("a middleware after a throwing middleware never runs", async () => {
    const middleware = new EmbeddingMiddleware();
    let secondRan = false;
    middleware.use(async () => {
      throw new Error("boom");
    });
    middleware.use(async () => {
      secondRan = true;
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow();
    expect(secondRan).toBe(false);
  });
});
