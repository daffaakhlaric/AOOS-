import type { Result } from "@aos/common";

import type { Objective } from "../../domain/entities/Objective.js";
import type { ObjectiveError } from "../../domain/errors/index.js";
import type { CreateObjective, CreateObjectiveInput } from "../use-cases/CreateObjective.js";
import type { GetObjective, GetObjectiveInput } from "../use-cases/GetObjective.js";
import type {
  GetObjectiveStatus,
  GetObjectiveStatusInput,
  GetObjectiveStatusOutput,
} from "../use-cases/GetObjectiveStatus.js";
import type { UpdateObjective, UpdateObjectiveInput } from "../use-cases/UpdateObjective.js";

/**
 * A convenience facade over the four Objective-lifecycle use cases (spec index.ts: exported
 * publicly), so a caller (e.g. `apps/aaos-api`) can depend on one composed service instead of
 * wiring four separate use-case instances.
 */
export class ObjectiveService {
  constructor(
    private readonly createObjectiveUseCase: CreateObjective,
    private readonly updateObjectiveUseCase: UpdateObjective,
    private readonly getObjectiveUseCase: GetObjective,
    private readonly getObjectiveStatusUseCase: GetObjectiveStatus,
  ) {}

  create(input: CreateObjectiveInput): Promise<Result<Objective, ObjectiveError>> {
    return this.createObjectiveUseCase.execute(input);
  }

  update(input: UpdateObjectiveInput): Promise<Result<Objective, ObjectiveError>> {
    return this.updateObjectiveUseCase.execute(input);
  }

  get(input: GetObjectiveInput): Result<Objective, ObjectiveError> {
    return this.getObjectiveUseCase.execute(input);
  }

  getStatus(input: GetObjectiveStatusInput): Result<GetObjectiveStatusOutput, ObjectiveError> {
    return this.getObjectiveStatusUseCase.execute(input);
  }
}
