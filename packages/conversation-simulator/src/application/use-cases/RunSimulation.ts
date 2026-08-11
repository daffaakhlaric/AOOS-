import type { Result } from "@aos/common";

import type { SimulatorConfig } from "../../config/SimulatorConfig.js";
import type { SimulationResult } from "../../domain/entities/SimulationResult.js";
import type { SimulatorError } from "../../domain/errors/SimulatorError.js";
import type { PersonaId } from "../../domain/value-objects/PersonaId.js";
import type { SimulationRunnerService } from "../services/SimulationRunnerService.js";

/** Main entry point (spec "application/use-cases/RunSimulation.ts"): persona + config → `SimulationResult`. */
export class RunSimulation {
  constructor(private readonly runner: SimulationRunnerService) {}

  async execute(
    personaId: PersonaId,
    config: SimulatorConfig,
  ): Promise<Result<SimulationResult, SimulatorError>> {
    return this.runner.runSimulation(personaId, config);
  }
}
