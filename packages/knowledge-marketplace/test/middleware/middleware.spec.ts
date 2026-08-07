import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceMiddleware } from "../../src/middleware/knowledge-marketplace-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeMarketplaceMiddleware", () => {
  it("size is 0 for a fresh chain", () => {
    expect(new KnowledgeMarketplaceMiddleware().size).toBe(0);
  });

  it("use appends a middleware and returns this for chaining", () => {
    const middleware = new KnowledgeMarketplaceMiddleware();
    const result = middleware.use(() => undefined);
    expect(result).toBe(middleware);
    expect(middleware.size).toBe(1);
  });

  it("runs middlewares in registration order", async () => {
    const calls: string[] = [];
    const middleware = new KnowledgeMarketplaceMiddleware();
    middleware.use(async (_execution, next) => {
      calls.push("a-before");
      await next();
      calls.push("a-after");
    });
    middleware.use(async (_execution, next) => {
      calls.push("b");
      await next();
    });
    await middleware.run(executionFixture());
    expect(calls).toEqual(["a-before", "b", "a-after"]);
  });

  it("runs with an empty chain without error", async () => {
    await expect(
      new KnowledgeMarketplaceMiddleware().run(executionFixture()),
    ).resolves.toBeUndefined();
  });

  it("passes the execution through to each middleware", async () => {
    const middleware = new KnowledgeMarketplaceMiddleware();
    const execution = executionFixture();
    let seen: unknown;
    middleware.use((exec, next) => {
      seen = exec;
      return next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });

  it("throws when next() is called twice in one middleware", async () => {
    const middleware = new KnowledgeMarketplaceMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(executionFixture())).rejects.toThrow(
      "next() called multiple times in one Marketplace Middleware",
    );
  });

  it("supports a synchronous middleware that does not call next()", async () => {
    const calls: string[] = [];
    const middleware = new KnowledgeMarketplaceMiddleware();
    middleware.use(() => {
      calls.push("only");
    });
    middleware.use(() => {
      calls.push("never reached");
    });
    await middleware.run(executionFixture());
    expect(calls).toEqual(["only"]);
  });
});
