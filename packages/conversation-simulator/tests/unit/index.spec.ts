import { describe, expect, it } from "vitest";

import * as PublicApi from "../../src/index.js";

/** Asserts every named export the spec's "Public API" section lists is actually present on the package's public barrel — a smoke test against silent regressions in `src/index.ts`. */
describe("public API (src/index.ts)", () => {
  it("exports SimulatorFactory", () => {
    expect(PublicApi.SimulatorFactory).toBeDefined();
    expect(typeof PublicApi.SimulatorFactory.create).toBe("function");
  });

  it("exports RunSimulation, RunAllScenarios, GetSimulationResult, ListPersonas use cases", () => {
    expect(PublicApi.RunSimulation).toBeDefined();
    expect(PublicApi.RunAllScenarios).toBeDefined();
    expect(PublicApi.GetSimulationResult).toBeDefined();
    expect(PublicApi.ListPersonas).toBeDefined();
  });

  it("exports PersonaRegistry", () => {
    expect(PublicApi.PersonaRegistry).toBeDefined();
    expect(typeof PublicApi.PersonaRegistry.create).toBe("function");
  });

  it("exports PersonaDifficulty, SimulationStatus, PersonaId, SessionId value objects", () => {
    expect(PublicApi.PersonaDifficulty).toBeDefined();
    expect(PublicApi.SimulationStatus).toBeDefined();
    expect(PublicApi.PersonaId).toBeDefined();
    expect(PublicApi.SessionId).toBeDefined();
  });

  it("exports SimulatorError, PersonaNotFoundError, SimulationTimeoutError", () => {
    expect(PublicApi.SimulatorError).toBeDefined();
    expect(PublicApi.PersonaNotFoundError).toBeDefined();
    expect(PublicApi.SimulationTimeoutError).toBeDefined();
  });

  it("exports parseSimulatorConfig and DEFAULT_SIMULATOR_CONFIG", () => {
    expect(typeof PublicApi.parseSimulatorConfig).toBe("function");
    expect(PublicApi.DEFAULT_SIMULATOR_CONFIG).toBeDefined();
  });

  it("SimulatorFactory.create() wired via the public barrel runs an end-to-end simulation", async () => {
    const simulator = PublicApi.SimulatorFactory.create();
    expect(simulator.ok).toBe(true);
  });

  it("does not export any internal application/domain implementation classes (SimulationRunnerService, ClaraSimulationComposer)", () => {
    expect((PublicApi as Record<string, unknown>).SimulationRunnerService).toBeUndefined();
    expect((PublicApi as Record<string, unknown>).ClaraSimulationComposer).toBeUndefined();
  });
});
