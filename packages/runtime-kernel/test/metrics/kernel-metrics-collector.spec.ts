import { describe, expect, it } from "vitest";

import { KernelMetricsCollector } from "../../src/metrics/kernel-metrics-collector.js";

describe("KernelMetricsCollector", () => {
  it("snapshot() reports uptime, memory, module/plugin counts, and a full health score", async () => {
    const collector = new KernelMetricsCollector({
      startedAt: new Date(Date.now() - 200),
      getModuleCount: () => 4,
      getPluginCount: () => 1,
      getHealthReport: async () => ({
        status: "healthy",
        checks: [
          { name: "memory", status: "healthy" },
          { name: "cpu", status: "healthy" },
        ],
      }),
    });

    const snapshot = await collector.snapshot();

    expect(snapshot.uptimeMs).toBeGreaterThanOrEqual(200);
    expect(snapshot.moduleCount).toBe(4);
    expect(snapshot.pluginCount).toBe(1);
    expect(snapshot.healthScore).toBe(1);
    expect(snapshot.bootTimeMs).toBeUndefined();
    expect(snapshot.memoryUsageBytes).toBeGreaterThan(0);
  });

  it("computes a partial health score when some checks fail", async () => {
    const collector = new KernelMetricsCollector({
      startedAt: new Date(),
      getModuleCount: () => 0,
      getPluginCount: () => 0,
      getHealthReport: async () => ({
        status: "unhealthy",
        checks: [
          { name: "a", status: "healthy" },
          { name: "b", status: "unhealthy" },
        ],
      }),
    });

    expect((await collector.snapshot()).healthScore).toBe(0.5);
  });

  it("treats zero health checks as a full (1.0) score, not division-by-zero NaN", async () => {
    const collector = new KernelMetricsCollector({
      startedAt: new Date(),
      getModuleCount: () => 0,
      getPluginCount: () => 0,
      getHealthReport: async () => ({ status: "healthy", checks: [] }),
    });

    expect((await collector.snapshot()).healthScore).toBe(1);
  });

  it("recordBootTime() is reflected in subsequent snapshots", async () => {
    const collector = new KernelMetricsCollector({
      startedAt: new Date(),
      getModuleCount: () => 0,
      getPluginCount: () => 0,
      getHealthReport: async () => ({ status: "healthy", checks: [] }),
    });

    collector.recordBootTime(123);
    expect((await collector.snapshot()).bootTimeMs).toBe(123);
  });
});
