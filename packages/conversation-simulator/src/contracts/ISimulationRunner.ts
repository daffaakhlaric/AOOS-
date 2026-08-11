import type { Result } from "@aos/common";

import type { SimulatorConfig } from "../config/SimulatorConfig.js";
import type { SimulationResult } from "../domain/entities/SimulationResult.js";
import type { SimulatorError } from "../domain/errors/SimulatorError.js";
import type { PersonaId } from "../domain/value-objects/PersonaId.js";

/** Port for the simulation engine (spec "Simulation Engine" flow). */
export interface ISimulationRunner {
  runSimulation(
    personaId: PersonaId,
    config: SimulatorConfig,
  ): Promise<Result<SimulationResult, SimulatorError>>;
}
