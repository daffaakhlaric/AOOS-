import { err, ok, type Result } from "@aos/common";

import { calculateD3Needed } from "../../calculators/BackwardPlanningCalculator.js";
import type { ObjectiveEngineConfig } from "../../config/ObjectiveEngineConfig.js";
import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { Objective } from "../../domain/entities/Objective.js";
import type { ObjectiveProgress } from "../../domain/entities/ObjectiveProgress.js";
import { ObjectiveNotFoundError, type ObjectiveError } from "../../domain/errors/index.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";

export interface GetObjectiveStatusInput {
  readonly objectiveId: ObjectiveId;
}

export interface GetObjectiveStatusOutput {
  readonly objective: Objective;
  /** The most recent `UpdateProgress` snapshot, if any has been recorded yet. */
  readonly progress?: ObjectiveProgress;
  /**
   * The pure, `AdAccount`-independent half of the Backward Planning Algorithm (spec: "d3_needed
   * = target_hot_leads / hot_lead_rate") — informational only, computed directly from the
   * Objective's own target and `config.hotLeadConversionRate`. See package report
   * "backward-planning placement" for why this does not include `budget_needed`/
   * `recommended_budget` (those need an `AdAccount`, only available to `ForecastObjective`).
   */
  readonly d3Needed: number;
}

/** Composed read-model for an Objective: its current state, latest progress (if any), and informational backward-planning figures (spec: "GetObjectiveStatus"). */
export class GetObjectiveStatus {
  constructor(
    private readonly repository: IObjectiveRepository,
    private readonly config: ObjectiveEngineConfig,
  ) {}

  execute(input: GetObjectiveStatusInput): Result<GetObjectiveStatusOutput, ObjectiveError> {
    const found = this.repository.findById(input.objectiveId);
    if (!found.some) {
      return err(
        new ObjectiveNotFoundError(`No Objective found with id "${input.objectiveId.toString()}"`),
      );
    }
    const objective = found.value;
    const progress = this.repository.findLatestProgress(input.objectiveId);
    const d3Needed = calculateD3Needed(
      objective.targetHotLeads.toNumber(),
      this.config.hotLeadConversionRate,
    );

    return ok({
      objective,
      ...(progress.some ? { progress: progress.value } : {}),
      d3Needed,
    });
  }
}
