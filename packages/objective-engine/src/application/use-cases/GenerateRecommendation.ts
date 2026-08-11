import { err, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";
import type { AdAccount } from "@aos/meta-ads-connector";
import type { getTracer } from "@aos/telemetry";

import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { TamaraRecommendation } from "../../domain/entities/TamaraRecommendation.js";
import { ObjectiveNotFoundError, type ObjectiveError } from "../../domain/errors/index.js";
import type { ObjectiveEngineEvents } from "../../domain/events/ObjectiveEngineEvents.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";
import type { RecommendationService } from "../services/RecommendationService.js";

export type Tracer = ReturnType<typeof getTracer>;

export interface GenerateRecommendationInput {
  readonly objectiveId: ObjectiveId;
  readonly adAccount: AdAccount;
  readonly correlationId: string;
}

/** Runs the Tamara recommendation algorithm for an Objective and stores/publishes the result (spec: "GenerateRecommendation"). */
export class GenerateRecommendation {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly recommendationService: RecommendationService,
    private readonly events: ObjectiveEngineEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    input: GenerateRecommendationInput,
  ): Promise<Result<TamaraRecommendation, ObjectiveError>> {
    return this.tracer.startActiveSpan(
      "objective-engine.generate-recommendation",
      async (span: { end: () => void }) => {
        try {
          return await this.run(input);
        } finally {
          span.end();
        }
      },
    );
  }

  private async run(
    input: GenerateRecommendationInput,
  ): Promise<Result<TamaraRecommendation, ObjectiveError>> {
    const found = this.repository.findById(input.objectiveId);
    if (!found.some) {
      return err(
        new ObjectiveNotFoundError(`No Objective found with id "${input.objectiveId.toString()}"`),
      );
    }
    const objective = found.value;
    const progress = this.repository.findLatestProgress(input.objectiveId);
    const now = this.now();

    const result = this.recommendationService.generate({
      objective,
      progress: progress.some ? progress.value : undefined,
      adAccount: input.adAccount,
      now,
    });
    /* v8 ignore next 3 */
    if (!result.ok) {
      return result;
    }

    this.repository.saveRecommendation(result.value);

    await this.events.publishRecommendationGenerated({
      objectiveId: input.objectiveId.toString(),
      tenantId: objective.tenantId,
      actionCount: result.value.actions.length,
      confidence: result.value.confidence,
      correlationId: input.correlationId,
      occurredAt: now,
      version: "1.0",
    });

    this.logger.info(
      {
        objectiveId: input.objectiveId.toString(),
        actionCount: result.value.actions.length,
        confidence: result.value.confidence,
      },
      "objective-engine: recommendation generated",
    );

    return result;
  }
}
