import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeMetrics } from "../../src/metrics/knowledge-runtime-metrics.js";
import { KnowledgeRuntimeMonitor } from "../../src/monitoring/knowledge-runtime-monitor.js";
import { KnowledgeRuntimeRegistry } from "../../src/registry/knowledge-runtime-registry.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Monitoring Test — KnowledgeRuntimeMonitor", () => {
  it("sample() combines Metrics + Health into one Dashboard with all 7 sections", async () => {
    const { asset } = await engineFixture();
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(executionFixture(asset));
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordInstanceCreated();
    metrics.recordTenantUsage("tenant-1");
    metrics.recordWorkspaceUsage("ws-1");

    const monitor = new KnowledgeRuntimeMonitor(metrics, registry);
    const dashboard = monitor.sample();

    expect(dashboard.runtime).toEqual({ count: 1, active: 1 });
    expect(dashboard.execution).toEqual({ completed: 0, failed: 0 });
    expect(dashboard.lifecycle.statistics).toBeDefined();
    expect(dashboard.validation).toEqual({ failures: 0, status: "healthy" });
    expect(dashboard.tenant.usage).toEqual({ "tenant-1": 1 });
    expect(dashboard.workspace.usage).toEqual({ "ws-1": 1 });
    expect(dashboard.performance).toEqual({ averageExecutionTimeMs: 0, averageLoadTimeMs: 0 });
    expect(dashboard.sampledAt).toEqual(expect.any(String));
    expect(dashboard.health).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
  });

  it("exposes a shared KnowledgeRuntimeHealth instance via the health property", () => {
    const monitor = new KnowledgeRuntimeMonitor(
      new KnowledgeRuntimeMetrics(),
      new KnowledgeRuntimeRegistry(),
    );
    expect(monitor.health.check().status).toBe("unknown");
  });
});
