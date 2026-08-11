import type { IPublisher } from "@aos/event-bus";
import { createLogger, type Logger } from "@aos/logger";
import { getTracer } from "@aos/telemetry";

import { ForecastService } from "../application/services/ForecastService.js";
import { ObjectiveService } from "../application/services/ObjectiveService.js";
import { ProgressTrackingService } from "../application/services/ProgressTrackingService.js";
import { RecommendationService } from "../application/services/RecommendationService.js";
import { CreateObjective, type Tracer } from "../application/use-cases/CreateObjective.js";
import { ForecastObjective } from "../application/use-cases/ForecastObjective.js";
import { GenerateRecommendation } from "../application/use-cases/GenerateRecommendation.js";
import { GetObjective } from "../application/use-cases/GetObjective.js";
import { GetObjectiveStatus } from "../application/use-cases/GetObjectiveStatus.js";
import { UpdateObjective } from "../application/use-cases/UpdateObjective.js";
import { UpdateProgress } from "../application/use-cases/UpdateProgress.js";
import { ForecastCalculator } from "../calculators/ForecastCalculator.js";
import { ProgressCalculator } from "../calculators/ProgressCalculator.js";
import type { ObjectiveEngineConfig } from "../config/ObjectiveEngineConfig.js";
import { ObjectiveEngineEvents } from "../domain/events/ObjectiveEngineEvents.js";
import { InMemoryObjectiveRepository } from "../infrastructure/repositories/InMemoryObjectiveRepository.js";
import { ObjectiveRegistry } from "../registry/ObjectiveRegistry.js";

export interface ObjectiveEngineFactoryOptions {
  readonly config: ObjectiveEngineConfig;
  /** Real `@aos/event-bus` `IPublisher` — always caller-supplied, mirroring `@aos/meta-ads-connector`'s `MetaAdsConnectorFactory`. */
  readonly publisher: IPublisher;
  readonly logger?: Logger;
  readonly tracer?: Tracer;
  /** Injectable clock, threaded through every time-dependent use case — defaults to the real wall clock only here, at the outermost composition boundary. */
  readonly now?: () => Date;
}

export interface ObjectiveEngine {
  readonly objectiveService: ObjectiveService;
  readonly progressTrackingService: ProgressTrackingService;
  readonly forecastService: ForecastService;
  readonly recommendationService: RecommendationService;
  readonly createObjective: CreateObjective;
  readonly updateObjective: UpdateObjective;
  readonly getObjective: GetObjective;
  readonly getObjectiveStatus: GetObjectiveStatus;
  readonly updateProgress: UpdateProgress;
  readonly generateRecommendation: GenerateRecommendation;
  readonly forecastObjective: ForecastObjective;
  readonly registry: ObjectiveRegistry;
  readonly repository: InMemoryObjectiveRepository;
}

/**
 * The composition root (Factory Pattern) — the single place every real `@aos/*` integration
 * (`@aos/event-bus` `IPublisher`, `@aos/logger` `createLogger`, `@aos/telemetry` `getTracer`)
 * and every internal component (calculators, repository, services) gets wired together into the
 * seven use cases + composed services the public API exposes, mirroring
 * `@aos/meta-ads-connector`'s `MetaAdsConnectorFactory`.
 */
export class ObjectiveEngineFactory {
  static create(options: ObjectiveEngineFactoryOptions): ObjectiveEngine {
    const logger = options.logger ?? createLogger({ serviceName: "objective-engine" });
    const tracer: Tracer = options.tracer ?? getTracer("objective-engine");
    const now = options.now ?? (() => new Date());

    const repository = new InMemoryObjectiveRepository();
    const events = new ObjectiveEngineEvents(options.publisher);
    const progressCalculator = new ProgressCalculator();
    const forecastStrategy = new ForecastCalculator();
    const recommendationService = new RecommendationService();

    const createObjective = new CreateObjective(
      repository,
      events,
      options.config,
      logger,
      tracer,
      now,
    );
    const updateObjective = new UpdateObjective(repository, events, logger, now);
    const getObjective = new GetObjective(repository);
    const getObjectiveStatus = new GetObjectiveStatus(repository, options.config);
    const updateProgress = new UpdateProgress(
      repository,
      progressCalculator,
      forecastStrategy,
      events,
      options.config,
      logger,
      tracer,
      now,
    );
    const generateRecommendation = new GenerateRecommendation(
      repository,
      recommendationService,
      events,
      logger,
      tracer,
      now,
    );
    const forecastObjective = new ForecastObjective(
      repository,
      progressCalculator,
      forecastStrategy,
      options.config,
      tracer,
      now,
    );

    const objectiveService = new ObjectiveService(
      createObjective,
      updateObjective,
      getObjective,
      getObjectiveStatus,
    );
    const progressTrackingService = new ProgressTrackingService(updateProgress);
    const forecastService = new ForecastService(forecastObjective, options.config);
    const registry = new ObjectiveRegistry(repository);

    return {
      objectiveService,
      progressTrackingService,
      forecastService,
      recommendationService,
      createObjective,
      updateObjective,
      getObjective,
      getObjectiveStatus,
      updateProgress,
      generateRecommendation,
      forecastObjective,
      registry,
      repository,
    };
  }
}
