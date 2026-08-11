import { describe, expect, it } from "vitest";

import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveEngineFactory } from "../../../src/factories/ObjectiveEngineFactory.js";
import { createFakePublisher } from "../../helpers/publisher.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

describe("ObjectiveEngineFactory", () => {
  it("wires every use case, service, registry, and repository", () => {
    const engine = ObjectiveEngineFactory.create({
      config: config(),
      publisher: createFakePublisher(),
    });

    expect(engine.objectiveService).toBeDefined();
    expect(engine.progressTrackingService).toBeDefined();
    expect(engine.forecastService).toBeDefined();
    expect(engine.recommendationService).toBeDefined();
    expect(engine.createObjective).toBeDefined();
    expect(engine.updateObjective).toBeDefined();
    expect(engine.getObjective).toBeDefined();
    expect(engine.getObjectiveStatus).toBeDefined();
    expect(engine.updateProgress).toBeDefined();
    expect(engine.generateRecommendation).toBeDefined();
    expect(engine.forecastObjective).toBeDefined();
    expect(engine.registry).toBeDefined();
    expect(engine.repository).toBeDefined();
  });

  it("accepts an injectable clock and uses it end-to-end", async () => {
    const fixedNow = new Date("2026-08-09T00:00:00.000Z");
    const engine = ObjectiveEngineFactory.create({
      config: config(),
      publisher: createFakePublisher(),
      now: () => fixedNow,
    });

    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.createdAt).toBe(fixedNow);
    }
  });

  it("uses default logger/tracer/now when not supplied — default now actually invoked end-to-end", async () => {
    const engine = ObjectiveEngineFactory.create({
      config: config(),
      publisher: createFakePublisher(),
    });
    expect(engine.repository).toBeDefined();
    // Exercises the default `() => new Date()` wall-clock closure via a real use-case call.
    const result = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 12, year: 2200 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-default-now",
    });
    expect(result.ok).toBe(true);
  });
});
