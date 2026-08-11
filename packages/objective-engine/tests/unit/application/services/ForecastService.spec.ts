import { describe, expect, it } from "vitest";

import { ForecastService } from "../../../../src/application/services/ForecastService.js";
import { ForecastObjective } from "../../../../src/application/use-cases/ForecastObjective.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ForecastCalculator } from "../../../../src/calculators/ForecastCalculator.js";
import { ProgressCalculator } from "../../../../src/calculators/ProgressCalculator.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../../../fixtures/adAccountFixtures.js";
import { TestClock } from "../../../helpers/clock.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

function setup() {
  const repository = new InMemoryObjectiveRepository();
  const clock = new TestClock("2026-08-09T00:00:00.000Z");
  const useCase = new ForecastObjective(
    repository,
    new ProgressCalculator(),
    new ForecastCalculator(),
    config(),
    createFakeTracer(),
    clock.now,
  );
  const service = new ForecastService(useCase, config());
  const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
  repository.save(objective);
  return { service, objective };
}

describe("ForecastService", () => {
  it("forecast() delegates to ForecastObjective", async () => {
    const { service, objective } = setup();
    const result = await service.forecast({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 12,
    });
    expect(result.ok).toBe(true);
  });

  it("getBudgetPlan() computes d3Needed/avgRphD3/budgetNeeded/recommendedBudget/isBudgetSufficient", () => {
    const { service, objective } = setup();
    const plan = service.getBudgetPlan(objective, buildAdAccountFixture());
    expect(plan.d3Needed).toBe(278); // target 50, rate 0.18
    expect(plan.avgRphD3).toBeGreaterThan(0);
    expect(plan.budgetNeeded).toBe(Math.ceil(plan.d3Needed * plan.avgRphD3));
    expect(plan.recommendedBudget).toBe(Math.ceil(plan.budgetNeeded * 1.15));
    expect(plan.isBudgetSufficient).toBe(
      objective.budgetAllocation.toNumber() >= plan.recommendedBudget,
    );
  });

  it("getBudgetPlan() handles an empty AdAccount (avgRphD3=0)", () => {
    const { service, objective } = setup();
    const plan = service.getBudgetPlan(objective, buildEmptyAdAccountFixture());
    expect(plan.avgRphD3).toBe(0);
    expect(plan.budgetNeeded).toBe(0);
    expect(plan.isBudgetSufficient).toBe(true);
  });
});
