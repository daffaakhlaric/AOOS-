// Factory
export { SimulatorFactory } from "./factories/SimulatorFactory.js";
export type { Simulator, SimulatorFactoryOptions } from "./factories/SimulatorFactory.js";

// Use Cases
export { RunSimulation } from "./application/use-cases/RunSimulation.js";
export { RunAllScenarios } from "./application/use-cases/RunAllScenarios.js";
export { GetSimulationResult } from "./application/use-cases/GetSimulationResult.js";
export { ListPersonas } from "./application/use-cases/ListPersonas.js";

// Registry
export { PersonaRegistry } from "./registry/PersonaRegistry.js";

// Domain
export type {
  SimulationResult,
  SimulationMessage,
  SimulationSession,
} from "./domain/entities/index.js";
export type { BuyerPersona } from "./domain/entities/BuyerPersona.js";
export { PersonaDifficulty } from "./domain/value-objects/PersonaDifficulty.js";
export { SimulationStatus } from "./domain/value-objects/SimulationStatus.js";
export { PersonaId } from "./domain/value-objects/PersonaId.js";
export { SessionId } from "./domain/value-objects/SessionId.js";

// Config
export type { SimulatorConfig, SimulatorConfigInput } from "./config/SimulatorConfig.js";
export { parseSimulatorConfig, DEFAULT_SIMULATOR_CONFIG } from "./config/SimulatorConfig.js";

// Errors
export {
  SimulatorError,
  PersonaNotFoundError,
  SimulationTimeoutError,
} from "./domain/errors/index.js";
