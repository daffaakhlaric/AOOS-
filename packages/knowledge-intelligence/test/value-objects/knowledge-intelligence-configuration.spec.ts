import { describe, expect, it } from "vitest";

import { InvalidWeightConfigurationException } from "../../src/errors/invalid-weight-configuration-exception.js";
import { KnowledgeIntelligenceConfiguration } from "../../src/value-objects/knowledge-intelligence-configuration.js";

describe("KnowledgeIntelligenceConfiguration", () => {
  it("provides sensible defaults", () => {
    const config = KnowledgeIntelligenceConfiguration.default();
    expect(config.healthWeights.quality).toBeGreaterThan(0);
    expect(config.similarityThresholds.duplicate).toBeGreaterThan(
      config.similarityThresholds.nearDuplicate,
    );
  });

  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(KnowledgeIntelligenceConfiguration.default())).toBe(true);
  });

  it("throws when health weights sum to 0", () => {
    expect(
      () =>
        new KnowledgeIntelligenceConfiguration({
          healthWeights: { quality: 0, freshness: 0, coverage: 0, risk: 0 },
          similarityThresholds: { duplicate: 0.95, nearDuplicate: 0.7, related: 0.5 },
          healthBands: [{ label: "x", min: 0 }],
          riskBands: [{ label: "y", min: 0 }],
          freshnessMaxAgeMs: 1000,
          readinessMinScore: 70,
        }),
    ).toThrow(InvalidWeightConfigurationException);
  });

  it("throws when a health weight is negative", () => {
    expect(
      () =>
        new KnowledgeIntelligenceConfiguration({
          healthWeights: { quality: -1, freshness: 1, coverage: 1, risk: 1 },
          similarityThresholds: { duplicate: 0.95, nearDuplicate: 0.7, related: 0.5 },
          healthBands: [{ label: "x", min: 0 }],
          riskBands: [{ label: "y", min: 0 }],
          freshnessMaxAgeMs: 1000,
          readinessMinScore: 70,
        }),
    ).toThrow(InvalidWeightConfigurationException);
  });

  it("throws when similarity thresholds are not strictly decreasing (duplicate <= nearDuplicate)", () => {
    expect(
      () =>
        new KnowledgeIntelligenceConfiguration({
          healthWeights: { quality: 1, freshness: 1, coverage: 1, risk: 1 },
          similarityThresholds: { duplicate: 0.5, nearDuplicate: 0.7, related: 0.3 },
          healthBands: [{ label: "x", min: 0 }],
          riskBands: [{ label: "y", min: 0 }],
          freshnessMaxAgeMs: 1000,
          readinessMinScore: 70,
        }),
    ).toThrow(InvalidWeightConfigurationException);
  });

  it("throws when similarity thresholds are not strictly decreasing (nearDuplicate <= related)", () => {
    expect(
      () =>
        new KnowledgeIntelligenceConfiguration({
          healthWeights: { quality: 1, freshness: 1, coverage: 1, risk: 1 },
          similarityThresholds: { duplicate: 0.95, nearDuplicate: 0.3, related: 0.5 },
          healthBands: [{ label: "x", min: 0 }],
          riskBands: [{ label: "y", min: 0 }],
          freshnessMaxAgeMs: 1000,
          readinessMinScore: 70,
        }),
    ).toThrow(InvalidWeightConfigurationException);
  });

  it("throws when freshnessMaxAgeMs is <= 0", () => {
    expect(
      () =>
        new KnowledgeIntelligenceConfiguration({
          healthWeights: { quality: 1, freshness: 1, coverage: 1, risk: 1 },
          similarityThresholds: { duplicate: 0.95, nearDuplicate: 0.7, related: 0.5 },
          healthBands: [{ label: "x", min: 0 }],
          riskBands: [{ label: "y", min: 0 }],
          freshnessMaxAgeMs: 0,
          readinessMinScore: 70,
        }),
    ).toThrow(InvalidWeightConfigurationException);
  });

  it("supports partial overrides via with()", () => {
    const config = KnowledgeIntelligenceConfiguration.default().with({ readinessMinScore: 90 });
    expect(config.readinessMinScore).toBe(90);
    expect(config.healthWeights).toEqual(
      KnowledgeIntelligenceConfiguration.default().healthWeights,
    );
  });
});
