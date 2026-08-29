// Factory
export { ObjectiveEngineFactory } from "./factories/ObjectiveEngineFactory.js";
export type {
  ObjectiveEngine,
  ObjectiveEngineFactoryOptions,
} from "./factories/ObjectiveEngineFactory.js";

// Use Cases
export { CreateObjective } from "./application/use-cases/CreateObjective.js";
export type { CreateObjectiveInput } from "./application/use-cases/CreateObjective.js";
export { UpdateObjective } from "./application/use-cases/UpdateObjective.js";
export type { UpdateObjectiveInput } from "./application/use-cases/UpdateObjective.js";
export { GetObjective } from "./application/use-cases/GetObjective.js";
export type { GetObjectiveInput } from "./application/use-cases/GetObjective.js";
export { UpdateProgress } from "./application/use-cases/UpdateProgress.js";
export type { UpdateProgressInput } from "./application/use-cases/UpdateProgress.js";
export { GenerateRecommendation } from "./application/use-cases/GenerateRecommendation.js";
export type { GenerateRecommendationInput } from "./application/use-cases/GenerateRecommendation.js";
export { ForecastObjective } from "./application/use-cases/ForecastObjective.js";
export type { ForecastObjectiveInput } from "./application/use-cases/ForecastObjective.js";
export { GetObjectiveStatus } from "./application/use-cases/GetObjectiveStatus.js";
export type {
  GetObjectiveStatusInput,
  GetObjectiveStatusOutput,
} from "./application/use-cases/GetObjectiveStatus.js";

// Services
export { ObjectiveService } from "./application/services/ObjectiveService.js";
export { ForecastService } from "./application/services/ForecastService.js";
export type { BudgetPlan } from "./application/services/ForecastService.js";
export { RecommendationService } from "./application/services/RecommendationService.js";
export type { RecommendationInput } from "./application/services/RecommendationService.js";

// Domain
export type { Objective } from "./domain/entities/Objective.js";
export type { ObjectiveProgress } from "./domain/entities/ObjectiveProgress.js";
export type {
  SamanthaRecommendation,
  RecommendedAction,
} from "./domain/entities/SamanthaRecommendation.js";
export type { ObjectiveId } from "./domain/value-objects/ObjectiveId.js";
export type { ObjectivePeriod } from "./domain/value-objects/ObjectivePeriod.js";
export type { OnTrackStatus } from "./domain/value-objects/OnTrackStatus.js";
export type { ForecastResult } from "./domain/value-objects/ForecastScore.js";
export { ObjectiveStatus } from "./domain/value-objects/ObjectiveStatus.js";

// Events
export type {
  ObjectiveCreated,
  ProgressUpdated,
  ObjectiveOffTrack,
  RecommendationGenerated,
} from "./domain/events/index.js";

// Errors
export {
  ObjectiveError,
  ObjectiveNotFoundError,
  InvalidObjectiveError,
  ForecastError,
} from "./domain/errors/index.js";

// Config
export type {
  ObjectiveEngineConfig,
  ObjectiveEngineConfigInput,
} from "./config/ObjectiveEngineConfig.js";
export {
  parseObjectiveEngineConfig,
  ObjectiveEngineConfigSchema,
  DEFAULT_OBJECTIVE_ENGINE_CONFIG,
} from "./config/ObjectiveEngineConfig.js";

// Registry
export { ObjectiveRegistry } from "./registry/ObjectiveRegistry.js";
