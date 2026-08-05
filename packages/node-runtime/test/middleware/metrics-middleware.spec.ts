import { describe, expect, it, vi } from "vitest";

import { NodeRuntimeMetricsCollector } from "../../src/metrics/node-runtime-metrics-collector.js";
import type { NodeMiddlewareContext } from "../../src/middleware/i-node-middleware.js";
import { MetricsMiddleware } from "../../src/middleware/metrics-middleware.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Node Middleware Test — MetricsMiddleware", () => {
  it("records Execution Latency for the operation on success", async () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const middleware = new MetricsMiddleware(metrics);
    const next = vi.fn(async () => {});
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await middleware.execute(context, next);

    expect(metrics.snapshot().averageExecutionLatencyMs["start"]).toBeGreaterThanOrEqual(0);
  });

  it("still records latency when next() throws", async () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const middleware = new MetricsMiddleware(metrics);
    const next = vi.fn(async () => {
      throw new Error("boom");
    });
    const context: NodeMiddlewareContext = {
      execution: executionFixture(),
      operation: "start",
      metadata: {},
    };

    await expect(middleware.execute(context, next)).rejects.toThrow("boom");
    expect(metrics.snapshot().averageExecutionLatencyMs["start"]).toBeGreaterThanOrEqual(0);
  });
});
