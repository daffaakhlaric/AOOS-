import { describe, expect, it } from "vitest";

import { GetObjective } from "../../../../src/application/use-cases/GetObjective.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { unwrap } from "../../../helpers/result.js";

describe("GetObjective", () => {
  it("returns the stored Objective for a known id", () => {
    const repository = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const useCase = new GetObjective(repository);
    const result = useCase.execute({ objectiveId: objective.id });
    expect(result.ok && result.value).toBe(objective);
  });

  it("returns ObjectiveNotFoundError for an unknown id", () => {
    const repository = new InMemoryObjectiveRepository();
    const useCase = new GetObjective(repository);
    const result = useCase.execute({ objectiveId: ObjectiveId.generate() });
    expect(result.ok).toBe(false);
  });
});
