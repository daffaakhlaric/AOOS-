import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationHealth } from "../../src/health/workflow-integration-health.js";
import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Health Test — WorkflowIntegrationHealth", () => {
  it("reports registry status 'unknown' when no Adapter is registered", () => {
    const metrics = new WorkflowIntegrationMetrics();
    const health = new WorkflowIntegrationHealth(new WorkflowIntegrationRegistry(), () =>
      metrics.snapshot(),
    );
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports a healthy Adapter as 'healthy' and an unavailable one as 'unavailable'", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("available", successfulRuntime()));
    registry.register(new CapabilityAdapter("unavailable"));
    const metrics = new WorkflowIntegrationMetrics();
    const health = new WorkflowIntegrationHealth(registry, () => metrics.snapshot());

    const report = health.check();

    expect(report.adapters["available"]?.status).toBe("healthy");
    expect(report.adapters["unavailable"]?.status).toBe("unavailable");
    expect(report.status).toBe("unavailable");
  });

  it("derives resolver status 'degraded' from a moderate failure ratio", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const metrics = new WorkflowIntegrationMetrics();
    for (let i = 0; i < 8; i += 1) {
      metrics.recordIntegrationCompleted(10);
    }
    for (let i = 0; i < 2; i += 1) {
      metrics.recordIntegrationFailed();
    }
    const health = new WorkflowIntegrationHealth(registry, () => metrics.snapshot());
    expect(health.check().resolver.status).toBe("degraded");
  });

  it("derives resolver status 'unavailable' from a majority failure ratio", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const metrics = new WorkflowIntegrationMetrics();
    for (let i = 0; i < 4; i += 1) {
      metrics.recordIntegrationCompleted(10);
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordIntegrationFailed();
    }
    const health = new WorkflowIntegrationHealth(registry, () => metrics.snapshot());
    expect(health.check().resolver.status).toBe("unavailable");
  });

  it("reports overall status 'healthy' when every Adapter is available and no failures occurred", () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const metrics = new WorkflowIntegrationMetrics();
    const health = new WorkflowIntegrationHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("healthy");
  });
});
