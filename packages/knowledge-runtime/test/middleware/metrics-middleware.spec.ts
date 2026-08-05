import { describe, expect, it, vi } from "vitest";

import { KnowledgeRuntimeFactory } from "../../src/factory/knowledge-runtime-factory.js";
import { KnowledgeRuntimeMetrics } from "../../src/metrics/knowledge-runtime-metrics.js";
import { MetricsMiddleware } from "../../src/middleware/metrics-middleware.js";

const factory = new KnowledgeRuntimeFactory();

describe("Middleware Test — MetricsMiddleware", () => {
  it("records Tenant and Workspace usage, then calls next()", async () => {
    const metrics = new KnowledgeRuntimeMetrics();
    const middleware = new MetricsMiddleware(metrics);
    const execution = factory.createExecution({
      knowledgeId: "k-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
    });
    const next = vi.fn(async () => {});
    await middleware.execute({ execution, operation: "load", metadata: {} }, next);
    expect(next).toHaveBeenCalledOnce();
    expect(metrics.snapshot().tenantUsage).toEqual({ "tenant-1": 1 });
    expect(metrics.snapshot().workspaceUsage).toEqual({ "ws-1": 1 });
  });

  it("skips Workspace usage when workspaceId is unset", async () => {
    const metrics = new KnowledgeRuntimeMetrics();
    const middleware = new MetricsMiddleware(metrics);
    const execution = factory.createExecution({ knowledgeId: "k-1", tenantId: "tenant-1" });
    await middleware.execute(
      { execution, operation: "load", metadata: {} },
      vi.fn(async () => {}),
    );
    expect(metrics.snapshot().workspaceUsage).toEqual({});
  });
});
