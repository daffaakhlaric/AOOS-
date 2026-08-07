import { describe, expect, it, vi } from "vitest";

import type { KnowledgeQualityConfig } from "../../src/config/knowledge-quality-config.js";
import { qualityFixture } from "../helpers/quality-fixture.js";

describe("KnowledgeQualityConfig", () => {
  it("every field is optional — an empty config is valid", () => {
    const config: KnowledgeQualityConfig = {};
    const { quality } = qualityFixture(config);
    expect(quality.hasProvider()).toBe(false);
    expect(quality.hasScoringProvider()).toBe(false);
  });

  it("accepts a ruleProvider/policyProvider without wiring them to any behavior", () => {
    const config: KnowledgeQualityConfig = {
      ruleProvider: {} as never,
      policyProvider: {} as never,
    };
    expect(() => qualityFixture(config)).not.toThrow();
  });

  it("wires provider/scoringProvider through to hasProvider()/hasScoringProvider()", () => {
    const config: KnowledgeQualityConfig = {
      provider: { assess: vi.fn(async () => ({ findings: [] })) },
      scoringProvider: { score: vi.fn(async () => []) },
    };
    const { quality } = qualityFixture(config);
    expect(quality.hasProvider()).toBe(true);
    expect(quality.hasScoringProvider()).toBe(true);
  });

  it("accepts the 2 Future Readiness (005.7M/005.7N) provider fields without wiring them to any behavior", () => {
    const config: KnowledgeQualityConfig = {
      validatorAiProvider: {} as never,
      embeddingManagerProvider: {} as never,
    };
    expect(() => qualityFixture(config)).not.toThrow();
  });

  it("accepts storage/publisher/auditProvider/scheduler/reporter/costProvider/streamingProvider/metricsProvider without wiring them to any behavior", () => {
    const config: KnowledgeQualityConfig = {
      storage: {} as never,
      publisher: {} as never,
      auditProvider: {} as never,
      scheduler: {} as never,
      reporter: {} as never,
      costProvider: {} as never,
      streamingProvider: {} as never,
      metricsProvider: {} as never,
    };
    expect(() => qualityFixture(config)).not.toThrow();
  });
});
