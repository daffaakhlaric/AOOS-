import { describe, expect, it } from "vitest";

import { GetObjectiveStatus } from "../../../../src/application/use-cases/GetObjectiveStatus.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveProgress } from "../../../../src/domain/entities/ObjectiveProgress.js";
import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../../../src/domain/value-objects/ForecastScore.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { OnTrackStatus } from "../../../../src/domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../../../src/domain/value-objects/ProgressPercentage.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { unwrap } from "../../../helpers/result.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

describe("GetObjectiveStatus", () => {
  it("returns the objective, no progress, and computed d3Needed for a fresh Objective", () => {
    const repository = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build()); // target 50
    repository.save(objective);
    const useCase = new GetObjectiveStatus(repository, config());
    const result = useCase.execute({ objectiveId: objective.id });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.objective).toBe(objective);
      expect(result.value.progress).toBeUndefined();
      expect(result.value.d3Needed).toBe(278); // 50 / 0.18 -> ceil -> 278
    }
  });

  it("includes the latest progress snapshot when one has been recorded", () => {
    const repository = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const progress = unwrap(
      ObjectiveProgress.create({
        objectiveId: objective.id,
        currentHotLeads: 12,
        currentSpend: unwrap(BudgetAllocation.create(8_500_000)),
        daysElapsed: 8,
        daysRemaining: 23,
        progressPercentage: unwrap(ProgressPercentage.create(24)),
        dailyRunRate: 1.5,
        requiredDailyRunRate: 1.65,
        forecastedHotLeads: unwrap(ForecastScore.create(46)),
        budgetBurnRate: 1_062_500,
        projectedBudgetAtEnd: unwrap(BudgetAllocation.create(33_000_000)),
        onTrackStatus: OnTrackStatus.AT_RISK,
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      }),
    );
    repository.saveProgress(progress);
    const useCase = new GetObjectiveStatus(repository, config());
    const result = useCase.execute({ objectiveId: objective.id });
    expect(result.ok && result.value.progress).toBe(progress);
  });

  it("returns ObjectiveNotFoundError for an unknown id", () => {
    const repository = new InMemoryObjectiveRepository();
    const useCase = new GetObjectiveStatus(repository, config());
    const result = useCase.execute({ objectiveId: ObjectiveId.generate() });
    expect(result.ok).toBe(false);
  });

  it("uses config.hotLeadConversionRate for d3Needed", () => {
    const repository = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const customConfig = { ...config(), hotLeadConversionRate: 0.5 };
    const useCase = new GetObjectiveStatus(repository, customConfig);
    const result = useCase.execute({ objectiveId: objective.id });
    expect(result.ok && result.value.d3Needed).toBe(100); // 50/0.5
  });
});
