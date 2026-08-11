import { describe, expect, it } from "vitest";

import {
  DEFAULT_OBJECTIVE_ENGINE_CONFIG,
  parseObjectiveEngineConfig,
} from "../../../src/config/ObjectiveEngineConfig.js";

describe("parseObjectiveEngineConfig", () => {
  it("parses a minimal valid input, applying defaults", () => {
    const result = parseObjectiveEngineConfig({ tenantId: "dss-motor" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tenantId).toBe("dss-motor");
      expect(result.value.hotLeadConversionRate).toBe(
        DEFAULT_OBJECTIVE_ENGINE_CONFIG.hotLeadConversionRate,
      );
      expect(result.value.budgetBufferFactor).toBe(
        DEFAULT_OBJECTIVE_ENGINE_CONFIG.budgetBufferFactor,
      );
      expect(result.value.onTrackThreshold).toBe(DEFAULT_OBJECTIVE_ENGINE_CONFIG.onTrackThreshold);
      expect(result.value.atRiskThreshold).toBe(DEFAULT_OBJECTIVE_ENGINE_CONFIG.atRiskThreshold);
      expect(result.value.maxObjectivesPerMonth).toBe(
        DEFAULT_OBJECTIVE_ENGINE_CONFIG.maxObjectivesPerMonth,
      );
    }
  });

  it("parses a fully-specified valid input", () => {
    const result = parseObjectiveEngineConfig({
      tenantId: "dss-motor",
      hotLeadConversionRate: 0.25,
      budgetBufferFactor: 1.2,
      onTrackThreshold: 0.9,
      atRiskThreshold: 0.5,
      maxObjectivesPerMonth: 3,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hotLeadConversionRate).toBe(0.25);
      expect(result.value.maxObjectivesPerMonth).toBe(3);
    }
  });

  it("rejects a missing tenantId", () => {
    const result = parseObjectiveEngineConfig({});
    expect(result.ok).toBe(false);
  });

  it("rejects an empty tenantId", () => {
    const result = parseObjectiveEngineConfig({ tenantId: "" });
    expect(result.ok).toBe(false);
  });

  it("rejects hotLeadConversionRate <= 0", () => {
    const result = parseObjectiveEngineConfig({ tenantId: "dss-motor", hotLeadConversionRate: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects hotLeadConversionRate > 1", () => {
    const result = parseObjectiveEngineConfig({
      tenantId: "dss-motor",
      hotLeadConversionRate: 1.5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects budgetBufferFactor < 1", () => {
    const result = parseObjectiveEngineConfig({ tenantId: "dss-motor", budgetBufferFactor: 0.9 });
    expect(result.ok).toBe(false);
  });

  it("rejects onTrackThreshold out of [0,1]", () => {
    expect(parseObjectiveEngineConfig({ tenantId: "dss-motor", onTrackThreshold: 1.5 }).ok).toBe(
      false,
    );
  });

  it("rejects atRiskThreshold out of [0,1]", () => {
    expect(parseObjectiveEngineConfig({ tenantId: "dss-motor", atRiskThreshold: -0.1 }).ok).toBe(
      false,
    );
  });

  it("rejects a non-positive maxObjectivesPerMonth", () => {
    expect(parseObjectiveEngineConfig({ tenantId: "dss-motor", maxObjectivesPerMonth: 0 }).ok).toBe(
      false,
    );
  });

  it("rejects a non-integer maxObjectivesPerMonth", () => {
    expect(
      parseObjectiveEngineConfig({ tenantId: "dss-motor", maxObjectivesPerMonth: 1.5 }).ok,
    ).toBe(false);
  });

  it("rejects atRiskThreshold greater than onTrackThreshold (cross-field rule)", () => {
    const result = parseObjectiveEngineConfig({
      tenantId: "dss-motor",
      onTrackThreshold: 0.5,
      atRiskThreshold: 0.6,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts atRiskThreshold equal to onTrackThreshold", () => {
    const result = parseObjectiveEngineConfig({
      tenantId: "dss-motor",
      onTrackThreshold: 0.5,
      atRiskThreshold: 0.5,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a completely malformed input (not an object)", () => {
    expect(parseObjectiveEngineConfig(null).ok).toBe(false);
    expect(parseObjectiveEngineConfig("bogus").ok).toBe(false);
  });
});

describe("DEFAULT_OBJECTIVE_ENGINE_CONFIG", () => {
  it("matches the spec's exact stated defaults", () => {
    expect(DEFAULT_OBJECTIVE_ENGINE_CONFIG).toEqual({
      hotLeadConversionRate: 0.18,
      budgetBufferFactor: 1.15,
      onTrackThreshold: 0.85,
      atRiskThreshold: 0.6,
      maxObjectivesPerMonth: 1,
    });
  });
});
