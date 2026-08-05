import { describe, expect, it } from "vitest";

import { KnowledgeSourceMiddlewarePipeline } from "../../src/middleware/knowledge-source-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeSourceMiddlewarePipeline additional coverage", () => {
  it("passes the Execution through to every middleware", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    const execution = executionFixture();
    let seen: unknown;
    pipeline.use(async (exec, next) => {
      seen = exec;
      await next();
    });
    await pipeline.run(execution);
    expect(seen).toBe(execution);
  });

  it("a middleware that never calls next() short-circuits the chain", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    const order: string[] = [];
    pipeline.use(() => {
      order.push("first");
    });
    pipeline.use(async (_execution, next) => {
      order.push("second");
      await next();
    });
    await pipeline.run(executionFixture());
    expect(order).toEqual(["first"]);
  });

  it("supports synchronous (non-Promise) middleware functions", async () => {
    const pipeline = new KnowledgeSourceMiddlewarePipeline();
    let called = false;
    pipeline.use((_execution, next) => {
      called = true;
      void next();
    });
    await pipeline.run(executionFixture());
    expect(called).toBe(true);
  });
});
