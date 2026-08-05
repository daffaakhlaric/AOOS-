import { describe, expect, it } from "vitest";

import { KnowledgeRuntimeHealth } from "../../src/health/knowledge-runtime-health.js";
import { KnowledgeRuntimeMetrics } from "../../src/metrics/knowledge-runtime-metrics.js";
import { KnowledgeRuntimeRegistry } from "../../src/registry/knowledge-runtime-registry.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("Health Test — KnowledgeRuntimeHealth", () => {
  it("reports registry status 'unknown' when empty", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    const report = health.check();
    expect(report.registry.status).toBe("unknown");
    expect(report.status).toBe("unknown");
  });

  it("reports registry status 'healthy' once populated", async () => {
    const { asset } = await engineFixture();
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(executionFixture(asset));
    const metrics = new KnowledgeRuntimeMetrics();
    const health = new KnowledgeRuntimeHealth(registry, () => metrics.snapshot());
    expect(health.check().registry.status).toBe("healthy");
  });

  it("derives validation status 'warning' from a low but non-zero ratio", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordInstanceCreated();
    }
    metrics.recordValidationFailure();
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("warning");
  });

  it("derives validation status 'unavailable' from a majority ratio", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordInstanceCreated();
    }
    for (let i = 0; i < 6; i += 1) {
      metrics.recordValidationFailure();
    }
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("unavailable");
  });

  it("derives validation status 'degraded' from a moderate ratio", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordInstanceCreated();
    }
    for (let i = 0; i < 3; i += 1) {
      metrics.recordValidationFailure();
    }
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().validation.status).toBe("degraded");
  });

  it("derives failureRate status 'warning' from a low but non-zero ratio", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    for (let i = 0; i < 10; i += 1) {
      metrics.recordInstanceCreated();
    }
    metrics.recordInstanceFailed();
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().failureRate.status).toBe("warning");
  });

  it("derives failureRate status from failedRuntimeCount/runtimeCount", () => {
    const metrics = new KnowledgeRuntimeMetrics();
    metrics.recordInstanceCreated();
    metrics.recordInstanceCreated();
    metrics.recordInstanceFailed();
    const health = new KnowledgeRuntimeHealth(new KnowledgeRuntimeRegistry(), () =>
      metrics.snapshot(),
    );
    expect(health.check().failureRate.status).toBe("degraded");
  });

  it("reports overall status 'healthy' with populated Registry, no activity, no failures", async () => {
    const { asset } = await engineFixture();
    const registry = new KnowledgeRuntimeRegistry();
    registry.register(executionFixture(asset));
    const metrics = new KnowledgeRuntimeMetrics();
    const health = new KnowledgeRuntimeHealth(registry, () => metrics.snapshot());
    expect(health.check().status).toBe("healthy");
  });
});
