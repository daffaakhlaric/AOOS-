import { ok } from "@aos/common";
import { describe, expect, it, vi } from "vitest";

import type { SimulationRunnerService } from "../../../../src/application/services/SimulationRunnerService.js";
import { RunSimulation } from "../../../../src/application/use-cases/RunSimulation.js";
import { PersonaId } from "../../../../src/domain/value-objects/PersonaId.js";
import { makeSimulatorConfig } from "../../../fixtures/simulatorFixtures.js";

describe("RunSimulation", () => {
  it("delegates to SimulationRunnerService.runSimulation with the exact args", async () => {
    const runSimulation = vi.fn().mockResolvedValue(ok("fake-result"));
    const runner = { runSimulation } as unknown as SimulationRunnerService;
    const useCase = new RunSimulation(runner);
    const config = makeSimulatorConfig();

    const result = await useCase.execute(PersonaId.READY_BUYER, config);

    expect(runSimulation).toHaveBeenCalledWith(PersonaId.READY_BUYER, config);
    expect(result).toEqual(ok("fake-result"));
  });
});
