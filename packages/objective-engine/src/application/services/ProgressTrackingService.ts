import type { Result } from "@aos/common";

import type { ObjectiveProgress } from "../../domain/entities/ObjectiveProgress.js";
import type { ObjectiveError } from "../../domain/errors/index.js";
import type { UpdateProgress, UpdateProgressInput } from "../use-cases/UpdateProgress.js";

/**
 * A thin facade over `UpdateProgress` — internal-only (not part of the spec's public
 * `index.ts`), kept for symmetry with `ObjectiveService`/`ForecastService`/`RecommendationService`
 * and as the natural extension point for future multi-step progress-tracking orchestration
 * (e.g. batching several Objectives' daily updates) without touching the use case itself.
 */
export class ProgressTrackingService {
  constructor(private readonly updateProgressUseCase: UpdateProgress) {}

  update(input: UpdateProgressInput): Promise<Result<ObjectiveProgress, ObjectiveError>> {
    return this.updateProgressUseCase.execute(input);
  }
}
