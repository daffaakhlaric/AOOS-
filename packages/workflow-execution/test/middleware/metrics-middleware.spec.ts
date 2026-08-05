import { describe, expect, it, vi } from "vitest";

import { ExecutionMetricsCollector } from "../../src/metrics/execution-metrics-collector.js";
import { MetricsMiddleware } from "../../src/middleware/metrics-middleware.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Middleware Test — MetricsMiddleware", () => {
  it("records operation latency on success", async () => {
    const metrics = new ExecutionMetricsCollector();
    const middleware = new MetricsMiddleware(metrics);
    const { session } = sessionFixture();

    await middleware.execute({ session, operation: "start", metadata: {} }, async () => {});

    expect(metrics.snapshot().averageOperationLatencyMs["start"]).toBeGreaterThanOrEqual(0);
  });

  it("records operation latency even when next() throws, and rethrows", async () => {
    const metrics = new ExecutionMetricsCollector();
    const middleware = new MetricsMiddleware(metrics);
    const { session } = sessionFixture();
    const next = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(
      middleware.execute({ session, operation: "start", metadata: {} }, next),
    ).rejects.toThrow("boom");
    expect(metrics.snapshot().averageOperationLatencyMs["start"]).toBeGreaterThanOrEqual(0);
  });
});
