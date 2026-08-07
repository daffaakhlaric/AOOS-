import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../../src/domain/knowledge-generator-execution.js";
import { KnowledgeGeneratorMiddleware } from "../../src/middleware/knowledge-generator-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(): KnowledgeGeneratorExecution {
  return {
    instance: {
      id: "g-1",
      token: "kgen_mw",
      generationId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ generationId: "g-1" }),
    metadata: {
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      requestedBy: "user-1",
      createdAt: now,
    },
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeGeneratorMiddleware", () => {
  it("starts empty", () => {
    expect(new KnowledgeGeneratorMiddleware().size).toBe(0);
  });

  it("use() registers a middleware and returns this for chaining", () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    const returned = middleware.use(async (_execution, next) => next());
    expect(returned).toBe(middleware);
    expect(middleware.size).toBe(1);
  });

  it("runs middlewares in registration order", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    const order: number[] = [];
    middleware.use(async (_execution, next) => {
      order.push(1);
      await next();
    });
    middleware.use(async (_execution, next) => {
      order.push(2);
      await next();
    });
    await middleware.run(buildExecution());
    expect(order).toEqual([1, 2]);
  });

  it("supports async middlewares", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    let ran = false;
    middleware.use(async (_execution, next) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      ran = true;
      await next();
    });
    await middleware.run(buildExecution());
    expect(ran).toBe(true);
  });

  it("passes the execution through to every middleware", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    const execution = buildExecution();
    let seen: KnowledgeGeneratorExecution | undefined;
    middleware.use(async (exec, next) => {
      seen = exec;
      await next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });

  it("does not require calling next()", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    let secondRan = false;
    middleware.use(() => {
      /* intentionally does not call next() */
    });
    middleware.use(async (_execution, next) => {
      secondRan = true;
      await next();
    });
    await middleware.run(buildExecution());
    expect(secondRan).toBe(false);
  });

  it("throws when next() is called more than once", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(buildExecution())).rejects.toThrow("next() called multiple times");
  });

  it("run() with no middlewares registered resolves without error", async () => {
    const middleware = new KnowledgeGeneratorMiddleware();
    await expect(middleware.run(buildExecution())).resolves.toBeUndefined();
  });
});
