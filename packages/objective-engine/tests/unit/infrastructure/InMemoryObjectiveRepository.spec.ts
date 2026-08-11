import { describe, expect, it } from "vitest";

import { ObjectiveBuilder } from "../../../src/builders/ObjectiveBuilder.js";
import { TamaraRecommendationBuilder } from "../../../src/builders/TamaraRecommendationBuilder.js";
import { ObjectiveProgress } from "../../../src/domain/entities/ObjectiveProgress.js";
import { BudgetAllocation } from "../../../src/domain/value-objects/BudgetAllocation.js";
import { ForecastScore } from "../../../src/domain/value-objects/ForecastScore.js";
import { ObjectiveId } from "../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectivePeriod } from "../../../src/domain/value-objects/ObjectivePeriod.js";
import { ObjectiveStatus } from "../../../src/domain/value-objects/ObjectiveStatus.js";
import { OnTrackStatus } from "../../../src/domain/value-objects/OnTrackStatus.js";
import { ProgressPercentage } from "../../../src/domain/value-objects/ProgressPercentage.js";
import { InMemoryObjectiveRepository } from "../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { unwrap } from "../../helpers/result.js";

function buildProgress(objectiveId: ObjectiveId) {
  return unwrap(
    ObjectiveProgress.create({
      objectiveId,
      currentHotLeads: 12,
      currentSpend: unwrap(BudgetAllocation.create(1_000_000)),
      daysElapsed: 8,
      daysRemaining: 23,
      progressPercentage: unwrap(ProgressPercentage.create(24)),
      dailyRunRate: 1.5,
      requiredDailyRunRate: 1.65,
      forecastedHotLeads: unwrap(ForecastScore.create(46)),
      budgetBurnRate: 125_000,
      projectedBudgetAtEnd: unwrap(BudgetAllocation.create(3_000_000)),
      onTrackStatus: OnTrackStatus.AT_RISK,
      updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    }),
  );
}

describe("InMemoryObjectiveRepository", () => {
  it("findById returns none for an unknown id", () => {
    const repo = new InMemoryObjectiveRepository();
    expect(repo.findById(ObjectiveId.generate()).some).toBe(false);
  });

  it("save then findById returns the saved Objective", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repo.save(objective);
    const found = repo.findById(objective.id);
    expect(found.some).toBe(true);
    if (found.some) {
      expect(found.value).toBe(objective);
    }
  });

  it("save overwrites a previously saved Objective with the same id", () => {
    const repo = new InMemoryObjectiveRepository();
    const id = ObjectiveId.generate();
    const first = unwrap(new ObjectiveBuilder().withId(id).build());
    const second = unwrap(new ObjectiveBuilder().withId(id).withTenantId("other").build());
    repo.save(first);
    repo.save(second);
    const found = repo.findById(id);
    expect(found.some && found.value.tenantId).toBe("other");
  });

  it("findActiveByTenantAndPeriod finds an ACTIVE objective", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
    repo.save(objective);
    const found = repo.findActiveByTenantAndPeriod(objective.tenantId, objective.period);
    expect(found.some).toBe(true);
  });

  it("findActiveByTenantAndPeriod finds a DRAFT objective", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.DRAFT).build());
    repo.save(objective);
    const found = repo.findActiveByTenantAndPeriod(objective.tenantId, objective.period);
    expect(found.some).toBe(true);
  });

  it("findActiveByTenantAndPeriod excludes COMPLETED/CANCELLED objectives", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.COMPLETED).build());
    repo.save(objective);
    const found = repo.findActiveByTenantAndPeriod(objective.tenantId, objective.period);
    expect(found.some).toBe(false);
  });

  it("findActiveByTenantAndPeriod returns none for a different tenant", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(
      new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).withTenantId("tenant-a").build(),
    );
    repo.save(objective);
    const found = repo.findActiveByTenantAndPeriod("tenant-b", objective.period);
    expect(found.some).toBe(false);
  });

  it("findActiveByTenantAndPeriod returns none for a different period", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
    repo.save(objective);
    const otherPeriod = unwrap(ObjectivePeriod.create({ month: 9, year: 2026 }));
    const found = repo.findActiveByTenantAndPeriod(objective.tenantId, otherPeriod);
    expect(found.some).toBe(false);
  });

  it("findLatestProgress/saveProgress round-trip", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repo.save(objective);
    expect(repo.findLatestProgress(objective.id).some).toBe(false);
    const progress = buildProgress(objective.id);
    repo.saveProgress(progress);
    const found = repo.findLatestProgress(objective.id);
    expect(found.some && found.value).toBe(progress);
  });

  it("findLatestRecommendation/saveRecommendation round-trip", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    const recommendation = unwrap(
      new TamaraRecommendationBuilder().withObjectiveId(objective.id).build(),
    );
    expect(repo.findLatestRecommendation(objective.id).some).toBe(false);
    repo.saveRecommendation(recommendation);
    const found = repo.findLatestRecommendation(objective.id);
    expect(found.some && found.value).toBe(recommendation);
  });

  it("listByTenant returns every objective for a tenant, ignoring others", () => {
    const repo = new InMemoryObjectiveRepository();
    const a1 = unwrap(
      new ObjectiveBuilder().withTenantId("a").withId(ObjectiveId.generate()).build(),
    );
    const a2 = unwrap(
      new ObjectiveBuilder()
        .withTenantId("a")
        .withId(ObjectiveId.generate())
        .withPeriod(unwrap(ObjectivePeriod.create({ month: 9, year: 2026 })))
        .build(),
    );
    const b1 = unwrap(new ObjectiveBuilder().withTenantId("b").build());
    repo.save(a1);
    repo.save(a2);
    repo.save(b1);
    const listed = repo.listByTenant("a");
    expect(listed.length).toBe(2);
    expect(listed).toContain(a1);
    expect(listed).toContain(a2);
  });

  it("clear() removes every objective/progress/recommendation", () => {
    const repo = new InMemoryObjectiveRepository();
    const objective = unwrap(new ObjectiveBuilder().build());
    repo.save(objective);
    repo.saveProgress(buildProgress(objective.id));
    repo.saveRecommendation(
      unwrap(new TamaraRecommendationBuilder().withObjectiveId(objective.id).build()),
    );
    repo.clear();
    expect(repo.findById(objective.id).some).toBe(false);
    expect(repo.findLatestProgress(objective.id).some).toBe(false);
    expect(repo.findLatestRecommendation(objective.id).some).toBe(false);
  });
});
