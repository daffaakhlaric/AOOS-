import { AdAccountId, CampaignBuilder, Spend, type AdAccount } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { ForecastObjective } from "../../../../src/application/use-cases/ForecastObjective.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ForecastCalculator } from "../../../../src/calculators/ForecastCalculator.js";
import { ProgressCalculator } from "../../../../src/calculators/ProgressCalculator.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { BudgetAllocation } from "../../../../src/domain/value-objects/BudgetAllocation.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import { buildEmptyAdAccountFixture } from "../../../fixtures/adAccountFixtures.js";
import { TestClock } from "../../../helpers/clock.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

/** An `AdAccount` with a single campaign carrying an explicit, non-zero `spend` (the `buildAdAccountFixture` helper's campaign spend defaults to `Spend.zero()` — see `@aos/meta-ads-connector`'s `CampaignBuilder`), needed to exercise the budget-constrained forecast branch which sums `campaign.spend`, not per-ad `AdMetrics.spend`. */
function buildAdAccountWithCampaignSpend(spend: number): AdAccount {
  const campaign = unwrap(new CampaignBuilder().withSpend(unwrap(Spend.create(spend))).build());
  return {
    id: unwrap(AdAccountId.create("act_752604553578354")),
    name: "DSS Motor Jakarta",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-08T00:00:00.000Z"),
  } as unknown as AdAccount;
}

function setup(now = "2026-08-09T00:00:00.000Z") {
  const repository = new InMemoryObjectiveRepository();
  const clock = new TestClock(now);
  const useCase = new ForecastObjective(
    repository,
    new ProgressCalculator(),
    new ForecastCalculator(),
    config(),
    createFakeTracer(),
    clock.now,
  );
  const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
  repository.save(objective);
  return { repository, useCase, objective };
}

describe("ForecastObjective", () => {
  it("computes an exact forecast for a known scenario (pinned: 12 hot leads, day 9 of August)", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(), // 0 spend, isolate the linear branch
      hotLeadsToDate: 12,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // daysElapsed=9, daysRemaining=22, dailyRunRate=12/9, forecast = floor(12 + (12/9)*22)
      expect(result.value.forecastedHotLeads).toBe(Math.floor(12 + (12 / 9) * 22));
    }
  });

  it("returns ObjectiveNotFoundError for an unknown objectiveId", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      objectiveId: ObjectiveId.generate(),
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 12,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative hotLeadsToDate", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: -1,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer hotLeadsToDate", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 1.4,
    });
    expect(result.ok).toBe(false);
  });

  it("triggers the budget-constrained forecast branch when spend nearly exhausts the budget", async () => {
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
    const objective = unwrap(
      new ObjectiveBuilder()
        .withStatus(ObjectiveStatus.ACTIVE)
        .withBudgetAllocation(unwrap(BudgetAllocation.create(9_000_000)))
        .build(),
    );
    repository.save(objective);
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountWithCampaignSpend(3_490_000), // budgetRemaining=5.51M, burnRate=3.49M/9d -> daysCanSustain ~14.2 < daysRemaining 22
      hotLeadsToDate: 12,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.budgetExhaustedAt).toBeDefined();
    }
  });

  it("returns onTrackStatus matching ProgressCalculator's classification", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 0,
    });
    expect(result.ok && result.value.onTrackStatus).toBe("OFF_TRACK");
  });

  it("uses the real wall clock when no `now` is injected (default constructor param)", async () => {
    const repository = new InMemoryObjectiveRepository();
    const useCase = new ForecastObjective(
      repository,
      new ProgressCalculator(),
      new ForecastCalculator(),
      config(),
      createFakeTracer(),
      // `now` intentionally omitted to exercise the default `() => new Date()`.
    );
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
    repository.save(objective);
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 5,
    });
    expect(result.ok).toBe(true);
  });

  it("no ads with SCALE verdict — forecast still succeeds on an empty AdAccount", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsToDate: 30,
    });
    expect(result.ok).toBe(true);
  });
});
