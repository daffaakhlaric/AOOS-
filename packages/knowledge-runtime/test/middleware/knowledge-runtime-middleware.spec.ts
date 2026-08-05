import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import type {
  IKnowledgeRuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeMiddlewareNext,
} from "../../src/middleware/i-runtime-middleware.js";
import { KnowledgeRuntimeMiddleware } from "../../src/middleware/knowledge-runtime-middleware.js";

const factory = new KnowledgeRuntimeFactory();

function stage(name: string, calls: string[]): IKnowledgeRuntimeMiddleware {
  return {
    name,
    async execute(_context: RuntimeMiddlewareContext, next: RuntimeMiddlewareNext) {
      calls.push(`${name}:before`);
      await next();
      calls.push(`${name}:after`);
    },
  };
}

describe("Middleware Test — KnowledgeRuntimeMiddleware", () => {
  it("runs registered middlewares in order, each wrapping next()", async () => {
    const calls: string[] = [];
    const pipeline = new KnowledgeRuntimeMiddleware().use(stage("a", calls)).use(stage("b", calls));
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await pipeline.execute({ execution, operation: "load", metadata: {} });
    expect(calls).toEqual(["a:before", "b:before", "b:after", "a:after"]);
  });

  it("returns the final context.execution", async () => {
    const pipeline = new KnowledgeRuntimeMiddleware();
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    const result = await pipeline.execute({ execution, operation: "load", metadata: {} });
    expect(result).toBe(execution);
  });

  it("throws when a middleware calls next() more than once", async () => {
    const pipeline = new KnowledgeRuntimeMiddleware().use({
      name: "double",
      async execute(_context, next) {
        await next();
        await next();
      },
    });
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await expect(pipeline.execute({ execution, operation: "load", metadata: {} })).rejects.toThrow(
      "next() called more than once",
    );
  });
});
