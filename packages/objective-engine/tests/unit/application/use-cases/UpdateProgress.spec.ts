import { createLogger } from "@aos/logger";
import { AdAccountId, CampaignBuilder, Spend, type AdAccount } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { UpdateProgress } from "../../../../src/application/use-cases/UpdateProgress.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ForecastCalculator } from "../../../../src/calculators/ForecastCalculator.js";
import { ProgressCalculator } from "../../../../src/calculators/ProgressCalculator.js";
import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { ObjectiveStatus } from "../../../../src/domain/value-objects/ObjectiveStatus.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../../../fixtures/adAccountFixtures.js";
import { TestClock } from "../../../helpers/clock.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

function setup(now = "2026-08-09T00:00:00.000Z") {
  const repository = new InMemoryObjectiveRepository();
  const publisher = createFakePublisher();
  const events = new ObjectiveEngineEvents(publisher);
  const clock = new TestClock(now);
  const useCase = new UpdateProgress(
    repository,
    new ProgressCalculator(),
    new ForecastCalculator(),
    events,
    config(),
    createLogger({ serviceName: "test" }),
    createFakeTracer(),
    clock.now,
  );
  const objective = unwrap(
    new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build(), // target 50, budget 30M, August 2026
  );
  repository.save(objective);
  return { repository, publisher, useCase, objective, clock };
}

describe("UpdateProgress", () => {
  it("computes progress metrics from a real AdAccount + hotLeadsCount", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currentHotLeads).toBe(12);
      expect(result.value.daysElapsed).toBe(9); // Aug 9 -> 9 days elapsed
      expect(result.value.daysRemaining).toBe(31 - 9);
    }
  });

  it("persists the progress snapshot via saveProgress", async () => {
    const { useCase, repository, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-2",
    });
    const found = repository.findLatestProgress(objective.id);
    expect(found.some).toBe(true);
  });

  it("emits ProgressUpdated", async () => {
    const { useCase, publisher, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-3",
    });
    expect(publisher.published.some((p) => p.type === "aaos.objective.progress.updated")).toBe(
      true,
    );
  });

  it("emits ObjectiveOffTrack when ratio < atRiskThreshold (0.60)", async () => {
    // Zero hot leads after several days -> ratio 0 -> OFF_TRACK.
    const { useCase, publisher, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 0,
      correlationId: "corr-4",
    });
    expect(result.ok && result.value.onTrackStatus).toBe("OFF_TRACK");
    expect(publisher.published.some((p) => p.type === "aaos.objective.off-track")).toBe(true);
  });

  it("does NOT emit ObjectiveOffTrack when ON_TRACK", async () => {
    const { useCase, publisher, objective } = setup();
    // High pace: 45 hot leads by day 9 vs target 50 -> well paced
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 45,
      correlationId: "corr-5",
    });
    expect(publisher.published.some((p) => p.type === "aaos.objective.off-track")).toBe(false);
  });

  it("returns ObjectiveNotFoundError for an unknown objectiveId", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      objectiveId: ObjectiveId.generate(),
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-6",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative hotLeadsCount", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: -1,
      correlationId: "corr-7",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer hotLeadsCount", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 1.5,
      correlationId: "corr-8",
    });
    expect(result.ok).toBe(false);
  });

  it("handles an AdAccount with 0 campaigns (edge case) — currentSpend 0", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 5,
      correlationId: "corr-9",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.currentSpend.toNumber()).toBe(0);
    }
  });

  it("100% target hit early -> transitions Objective to COMPLETED and emits ObjectiveCompleted", async () => {
    const { useCase, repository, publisher, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 50, // target is exactly 50
      correlationId: "corr-10",
    });
    expect(result.ok).toBe(true);
    const stored = repository.findById(objective.id);
    expect(stored.some && stored.value.status).toBe(ObjectiveStatus.COMPLETED);
    expect(publisher.published.some((p) => p.type === "aaos.objective.completed")).toBe(true);
  });

  it("exceeding target also completes the Objective", async () => {
    const { useCase, repository, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 60,
      correlationId: "corr-11",
    });
    const stored = repository.findById(objective.id);
    expect(stored.some && stored.value.status).toBe(ObjectiveStatus.COMPLETED);
  });

  it("does not re-emit ObjectiveCompleted for an already-COMPLETED objective", async () => {
    const { useCase, publisher, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 50,
      correlationId: "corr-12a",
    });
    const completedCountAfterFirst = publisher.published.filter(
      (p) => p.type === "aaos.objective.completed",
    ).length;
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 55,
      correlationId: "corr-12b",
    });
    const completedCountAfterSecond = publisher.published.filter(
      (p) => p.type === "aaos.objective.completed",
    ).length;
    expect(completedCountAfterFirst).toBe(1);
    expect(completedCountAfterSecond).toBe(1);
  });

  it("uses the real wall clock when no `now` is injected (default constructor param)", async () => {
    const repository = new InMemoryObjectiveRepository();
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    const useCase = new UpdateProgress(
      repository,
      new ProgressCalculator(),
      new ForecastCalculator(),
      events,
      config(),
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      // `now` intentionally omitted to exercise the default `() => new Date()`.
    );
    const objective = unwrap(new ObjectiveBuilder().withStatus(ObjectiveStatus.ACTIVE).build());
    repository.save(objective);
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 5,
      correlationId: "corr-default-now",
    });
    expect(result.ok).toBe(true);
  });

  it("zero hot leads after 15 days -> OFF_TRACK", async () => {
    const { useCase, objective } = setup("2026-08-15T00:00:00.000Z");
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 0,
      correlationId: "corr-13",
    });
    expect(result.ok && result.value.onTrackStatus).toBe("OFF_TRACK");
    expect(result.ok && result.value.daysElapsed).toBe(15);
  });

  it("budget exhausted before month ends -> budget-constrained forecast reflected in progress", async () => {
    // A campaign with spend high enough, relative to the objective's 30M budget and the
    // elapsed pace, to exhaust the remaining budget before the 22 remaining days are up.
    const { useCase, objective } = setup("2026-08-09T00:00:00.000Z");
    const campaign = unwrap(
      new CampaignBuilder().withSpend(unwrap(Spend.create(27_000_000))).build(),
    );
    const adAccount = {
      id: unwrap(AdAccountId.create("act_1")),
      name: "High Spend Account",
      businessManagerId: "bm_1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date("2026-08-08T00:00:00.000Z"),
    } as unknown as AdAccount;

    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount,
      hotLeadsCount: 12,
      correlationId: "corr-14",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // projectedBudgetAtEnd = currentSpend + budgetBurnRate * daysRemaining = 27M + 3M*22 = 93M
      // (ProgressCalculator's own cumulative projection — distinct from ForecastCalculator's
      // budget-capped forecastedSpend).
      expect(result.value.projectedBudgetAtEnd.toNumber()).toBe(27_000_000 + 3_000_000 * 22);
      expect(Number.isFinite(result.value.forecastedHotLeads.toNumber())).toBe(true);
    }
  });
});
