import { describe, expect, it } from "vitest";

import { ObjectiveBuilder } from "../../../src/builders/ObjectiveBuilder.js";
import { SamanthaRecommendationBuilder } from "../../../src/builders/SamanthaRecommendationBuilder.js";
import { ObjectiveProgress } from "../../../src/domain/entities/ObjectiveProgress.js";
import { BudgetAllocation } from "../../../src/domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../../src/domain/value-objects/ForecastScore.js";
import { ObjectiveId } from "../../../src/domain/value-objects/ObjectiveId.js";
import { OnTrackStatus } from "../../../src/domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../../src/domain/value-objects/ProgressPercentage.js";
import { InMemoryObjectiveRepository } from "../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { ObjectiveRegistry } from "../../../src/registry/ObjectiveRegistry.js";
import { unwrap } from "../../helpers/result.js";

describe("ObjectiveRegistry", () => {
  it("get() delegates to the repository's findById", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const found = registry.get(objective.id);
    expect(found.some && found.value).toBe(objective);
  });

  it("get() returns none for an unknown id", () => {
    const registry = new ObjectiveRegistry(new InMemoryObjectiveRepository());
    expect(registry.get(ObjectiveId.generate()).some).toBe(false);
  });

  it("listByTenant() delegates to the repository", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    const objective = unwrap(new ObjectiveBuilder().withTenantId("dss-motor").build());
    repository.save(objective);
    expect(registry.listByTenant("dss-motor")).toEqual([objective]);
  });

  it("getProgress() delegates to the repository's findLatestProgress", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const progress = unwrap(
      ObjectiveProgress.create({
        objectiveId: objective.id,
        currentHotLeads: 5,
        currentSpend: unwrap(BudgetAllocation.create(1_000_000)),
        daysElapsed: 5,
        daysRemaining: 5,
        progressPercentage: unwrap(ProgressPercentage.create(10)),
        dailyRunRate: 1,
        requiredDailyRunRate: 1,
        forecastedHotLeads: unwrap(ForecastScore.create(10)),
        budgetBurnRate: 200_000,
        projectedBudgetAtEnd: unwrap(BudgetAllocation.create(2_000_000)),
        onTrackStatus: OnTrackStatus.ON_TRACK,
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      }),
    );
    repository.saveProgress(progress);
    const found = registry.getProgress(objective.id);
    expect(found.some && found.value).toBe(progress);
  });

  it("getProgress() returns none when no progress recorded", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    expect(registry.getProgress(ObjectiveId.generate()).some).toBe(false);
  });

  it("getRecommendation() delegates to the repository's findLatestRecommendation", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const recommendation = unwrap(
      new SamanthaRecommendationBuilder().withObjectiveId(objective.id).build(),
    );
    repository.saveRecommendation(recommendation);
    const found = registry.getRecommendation(objective.id);
    expect(found.some && found.value).toBe(recommendation);
  });

  it("getRecommendation() returns none when no recommendation recorded", () => {
    const repository = new InMemoryObjectiveRepository();
    const registry = new ObjectiveRegistry(repository);
    expect(registry.getRecommendation(ObjectiveId.generate()).some).toBe(false);
  });
});
