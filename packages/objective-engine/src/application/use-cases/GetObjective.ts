import { err, ok, type Result } from "@aos/common";

import type { IObjectiveRepository } from "../../contracts/IObjectiveRepository.js";
import type { Objective } from "../../domain/entities/Objective.js";
import { ObjectiveNotFoundError, type ObjectiveError } from "../../domain/errors/index.js";
import type { ObjectiveId } from "../../domain/value-objects/ObjectiveId.js";

export interface GetObjectiveInput {
  readonly objectiveId: ObjectiveId;
}

/** Loads a stored `Objective` by id, or `ObjectiveNotFoundError` if none exists. */
export class GetObjective {
  constructor(private readonly repository: IObjectiveRepository) {}

  execute(input: GetObjectiveInput): Result<Objective, ObjectiveError> {
    const found = this.repository.findById(input.objectiveId);
    if (!found.some) {
      return err(
        new ObjectiveNotFoundError(`No Objective found with id "${input.objectiveId.toString()}"`),
      );
    }
    return ok(found.value);
  }
}
