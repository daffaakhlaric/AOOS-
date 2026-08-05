import { describe, expect, it } from "vitest";

import { KnowledgeIndexHealth } from "../../src/health/knowledge-index-health.js";
import { KnowledgeIndexMetrics } from "../../src/metrics/knowledge-index-metrics.js";
import { KnowledgeIndexRegistry } from "../../src/registry/knowledge-index-registry.js";

describe("Health Test — edge cases", () => {
  it("reports build status 'healthy' when buildCount is zero (no ratio to compute)", () => {
    const metrics = new KnowledgeIndexMetrics();
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    expect(health.check().build.status).toBe("healthy");
  });

  it("check() is idempotent — calling it twice in a row yields the same report", () => {
    const metrics = new KnowledgeIndexMetrics();
    const health = new KnowledgeIndexHealth(new KnowledgeIndexRegistry(), () => metrics.snapshot());
    expect(health.check()).toEqual(health.check());
  });
});
