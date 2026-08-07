import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../../src/domain/knowledge-quality-execution.js";
import { KnowledgeQualityMiddleware } from "../../src/middleware/knowledge-quality-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(): KnowledgeQualityExecution {
  return {
    instance: {
      id: "g-1",
      token: "kqua_mw",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeQualityAssessmentState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ assessmentId: "g-1" }),
    metadata: {
      assessmentId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      assessmentId: "g-1",
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    scoreMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeQualityMiddleware", () => {
  it("starts empty", () => {
    expect(new KnowledgeQualityMiddleware().size).toBe(0);
  });

  it("use() registers a middleware and returns this for chaining", () => {
    const middleware = new KnowledgeQualityMiddleware();
    const returned = middleware.use(async (_execution, next) => next());
    expect(returned).toBe(middleware);
    expect(middleware.size).toBe(1);
  });

  it("runs middlewares in registration order", async () => {
    const middleware = new KnowledgeQualityMiddleware();
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
    const middleware = new KnowledgeQualityMiddleware();
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
    const middleware = new KnowledgeQualityMiddleware();
    const execution = buildExecution();
    let seen: KnowledgeQualityExecution | undefined;
    middleware.use(async (exec, next) => {
      seen = exec;
      await next();
    });
    await middleware.run(execution);
    expect(seen).toBe(execution);
  });

  it("does not require calling next()", async () => {
    const middleware = new KnowledgeQualityMiddleware();
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
    const middleware = new KnowledgeQualityMiddleware();
    middleware.use(async (_execution, next) => {
      await next();
      await next();
    });
    await expect(middleware.run(buildExecution())).rejects.toThrow("next() called multiple times");
  });

  it("run() with no middlewares registered resolves without error", async () => {
    const middleware = new KnowledgeQualityMiddleware();
    await expect(middleware.run(buildExecution())).resolves.toBeUndefined();
  });
});
