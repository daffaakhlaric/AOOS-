import { describe, expect, it, vi } from "vitest";

import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { MetricsMiddleware } from "../../src/middleware/metrics-middleware.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";

describe("Middleware Test — MetricsMiddleware", () => {
  it("calls next() and records Tenant Usage when the Context has a tenantId", async () => {
    const metrics = new WorkflowIntegrationMetrics();
    const middleware = new MetricsMiddleware(metrics);
    const next = vi.fn(async () => {});

    await middleware.execute(
      middlewareContextFixture({ context: contextFixture({ tenantId: "tenant-1" }) }),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(metrics.snapshot().tenantUsage).toEqual({ "tenant-1": 1 });
  });

  it("does not record Tenant Usage when the Context has no tenantId", async () => {
    const metrics = new WorkflowIntegrationMetrics();
    const middleware = new MetricsMiddleware(metrics);
    await middleware.execute(middlewareContextFixture(), async () => {});
    expect(metrics.snapshot().tenantUsage).toEqual({});
  });
});
