import { describe, expect, it, vi } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import type { KnowledgeValidationExecution } from "../../src/domain/knowledge-validation-execution.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { KnowledgeValidatorMiddleware } from "../../src/middleware/knowledge-validator-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function buildExecution(): KnowledgeValidationExecution {
  const context = contextFixture({ validationId: "v-1" });
  return {
    instance: {
      id: "v-1",
      token: context.token,
      validationId: "v-1",
      tenantId: "t-1",
      state: KnowledgeValidationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context,
    metadata: {
      validationId: "v-1",
      title: "Title",
      tenantId: "t-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      validationId: "v-1",
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeValidatorMiddleware", () => {
  it("starts empty", () => {
    expect(new KnowledgeValidatorMiddleware().size).toBe(0);
  });

  it("use() registers a middleware and returns this for chaining", () => {
    const middleware = new KnowledgeValidatorMiddleware();
    const result = middleware.use(async () => {});
    expect(result).toBe(middleware);
    expect(middleware.size).toBe(1);
  });

  it("runs middlewares in registration order", async () => {
    const middleware = new KnowledgeValidatorMiddleware();
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

  it("supports synchronous middlewares", async () => {
    const middleware = new KnowledgeValidatorMiddleware();
    const fn = vi.fn((_execution, next: () => Promise<void>) => {
      void next();
    });
    middleware.use(fn);
    await middleware.run(buildExecution());
    expect(fn).toHaveBeenCalled();
  });

  it("runs with zero middlewares registered without error", async () => {
    await expect(new KnowledgeValidatorMiddleware().run(buildExecution())).resolves.toBeUndefined();
  });

  it("a middleware may skip calling next(), halting the chain", async () => {
    const middleware = new KnowledgeValidatorMiddleware();
    const second = vi.fn();
    middleware.use(async () => {
      /* does not call next() */
    });
    middleware.use(second);
    await middleware.run(buildExecution());
    expect(second).not.toHaveBeenCalled();
  });

  it("throws when next() is called twice in one middleware", async () => {
    const middleware = new KnowledgeValidatorMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(buildExecution())).rejects.toThrow("next() called multiple times");
  });

  it("passes the execution through to every middleware", async () => {
    const middleware = new KnowledgeValidatorMiddleware();
    const execution = buildExecution();
    let seen: unknown;
    middleware.use(async (exec, next) => {
      seen = exec;
      await next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });
});
