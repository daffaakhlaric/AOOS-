import { err, ErrorCode, ok } from "@aos/common";
import { LeadTemperature } from "@aos/sales-agent";
import { describe, expect, it, vi } from "vitest";

import { RunAllScenarios } from "../../../../src/application/use-cases/RunAllScenarios.js";
import type { RunSimulation } from "../../../../src/application/use-cases/RunSimulation.js";
import { SimulatorError } from "../../../../src/domain/errors/SimulatorError.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { SimulationStatus } from "../../../../src/domain/value-objects/SimulationStatus.js";
import { PersonaRegistry } from "../../../../src/registry/PersonaRegistry.js";
import { makeSimulatorConfig } from "../../../fixtures/simulatorFixtures.js";
import { unwrap } from "../../../helpers/result.js";

describe("RunAllScenarios", () => {
  it("runs all 10 personas and returns 10 results when every RunSimulation call succeeds", async () => {
    const registry = unwrap(PersonaRegistry.create());
    const execute = vi.fn().mockImplementation((personaId: PersonaId) =>
      Promise.resolve(
        ok({
          personaId,
          status: SimulationStatus.COMPLETED,
          finalTemperature: LeadTemperature.HOT,
        }),
      ),
    );
    const runSimulation = { execute } as unknown as RunSimulation;
    const useCase = new RunAllScenarios(runSimulation, registry);

    const results = unwrap(await useCase.execute(makeSimulatorConfig()));

    expect(results).toHaveLength(10);
    expect(execute).toHaveBeenCalledTimes(10);
  });

  it("synthesizes a FAILED result for a persona whose RunSimulation call errors, without aborting the batch", async () => {
    const registry = unwrap(PersonaRegistry.create());
    const execute = vi.fn().mockImplementation((personaId: PersonaId) => {
      if (personaId === PersonaId.GHOST_BUYER) {
        return Promise.resolve(err(new SimulatorError(ErrorCode.INTERNAL, "simulated failure")));
      }
      return Promise.resolve(
        ok({
          personaId,
          status: SimulationStatus.COMPLETED,
          finalTemperature: LeadTemperature.HOT,
        }),
      );
    });
    const runSimulation = { execute } as unknown as RunSimulation;
    const useCase = new RunAllScenarios(runSimulation, registry);

    const results = unwrap(await useCase.execute(makeSimulatorConfig()));

    expect(results).toHaveLength(10);
    const ghostResult = results.find((r) => r.personaId === PersonaId.GHOST_BUYER);
    expect(ghostResult?.status).toBe(SimulationStatus.FAILED);
    expect(ghostResult?.metExpectation).toBe(false);
    expect(ghostResult?.expectedOutcome).toBe(LeadTemperature.COLD);
  });

  it("propagates a persona-registry lookup failure while synthesizing a FAILED result", async () => {
    const execute = vi
      .fn()
      .mockResolvedValue(err(new SimulatorError(ErrorCode.INTERNAL, "simulated failure")));
    const runSimulation = { execute } as unknown as RunSimulation;
    const registry = {
      get: vi.fn().mockReturnValue(err(new SimulatorError(ErrorCode.NOT_FOUND, "gone"))),
    };
    const useCase = new RunAllScenarios(runSimulation, registry as never);

    const result = await useCase.execute(makeSimulatorConfig());

    expect(result.ok).toBe(false);
  });
});
