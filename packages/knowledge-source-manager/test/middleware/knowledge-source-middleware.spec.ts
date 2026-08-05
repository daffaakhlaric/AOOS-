import { describe, expect, it } from "vitest";

import { KnowledgeSourceMiddlewarePipeline } from "../../src/middleware/knowledge-source-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSourceMiddlewarePipeline", () => {
  it("runs middlewares in registration order", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    const order: string[] = [];
    pipeline.use(async (_execution, next) => {
      order.push("a-before");
      await next();
      order.push("a-after");
    });
    pipeline.use(async (_execution, next) => {
      order.push("b");
      await next();
    });
    await pipeline.run(executionFixture());
    expect(order).toEqual(["a-before", "b", "a-after"]);
  });

  it("supports source.use() chaining", () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    expect(pipeline.use(() => undefined)).toBe(pipeline);
  });

  it("reports its size", () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    pipeline.use(() => undefined);
    pipeline.use(() => undefined);
    expect(pipeline.size).toBe(2);
  });

  it("no-ops when no middleware is registered", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    await expect(pipeline.run(executionFixture())).resolves.toBeUndefined();
  });

  it("throws when next() is called more than once by the same middleware", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    pipeline.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(pipeline.run(executionFixture())).rejects.toThrow(
      "next() called multiple times in one Source Middleware",
    );
  });
});
