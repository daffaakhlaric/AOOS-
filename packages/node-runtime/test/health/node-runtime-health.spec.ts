import { describe, expect, it } from "vitest";

import { NodeRuntimeHealth } from "../../src/health/node-runtime-health.js";
import { NodeRuntimeMetricsCollector } from "../../src/metrics/node-runtime-metrics-collector.js";

describe("Health Test — NodeRuntimeHealth", () => {
  it("reports healthy across every component when nothing has failed", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const health = new NodeRuntimeHealth(() => metrics.snapshot());
    const report = health.check();
    expect(report.status).toBe("healthy");
    expect(report.runtime.status).toBe("healthy");
    expect(report.registry.status).toBe("healthy");
    expect(report.factory.status).toBe("healthy");
    expect(report.validator.status).toBe("healthy");
    expect(report.resolver.status).toBe("healthy");
  });

  it("derives degraded/unhealthy runtime status from the Metrics failure ratio", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const health = new NodeRuntimeHealth(() => metrics.snapshot());

    for (let i = 0; i < 8; i += 1) metrics.recordNodeSuccess(1);
    for (let i = 0; i < 2; i += 1) metrics.recordNodeFailure();
    expect(health.check().runtime.status).toBe("degraded");

    for (let i = 0; i < 10; i += 1) metrics.recordNodeFailure();
    expect(health.check().runtime.status).toBe("unhealthy");
  });

  it("recordError()/clearError() drive a component's health status", () => {
    const metrics = new NodeRuntimeMetricsCollector();
    const health = new NodeRuntimeHealth(() => metrics.snapshot());

    health.recordError("registry", "unreachable");
    const degraded = health.check();
    expect(degraded.registry.status).toBe("unhealthy");
    expect(degraded.status).toBe("unhealthy");
    expect(degraded.registry.details).toMatchObject({ error: "unreachable" });

    health.clearError("registry");
    expect(health.check().registry.status).toBe("healthy");
  });
});
