import { createLogger } from "@aos/logger";
import { describe, expect, it } from "vitest";

import { RecommendationService } from "../../../../src/application/services/RecommendationService.js";
import { GenerateRecommendation } from "../../../../src/application/use-cases/GenerateRecommendation.js";
import { ObjectiveBuilder } from "../../../../src/builders/ObjectiveBuilder.js";
import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { ObjectiveId } from "../../../../src/domain/value-objects/ObjectiveId.js";
import { InMemoryObjectiveRepository } from "../../../../src/infrastructure/repositories/InMemoryObjectiveRepository.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../../../fixtures/adAccountFixtures.js";
import { TestClock } from "../../../helpers/clock.js";
import { createFakePublisher } from "../../../helpers/publisher.js";
import { unwrap } from "../../../helpers/result.js";
import { createFakeTracer } from "../../../helpers/tracer.js";

function setup() {
  const repository = new InMemoryObjectiveRepository();
  const publisher = createFakePublisher();
  const events = new ObjectiveEngineEvents(publisher);
  const clock = new TestClock("2026-08-09T00:00:00.000Z");
  const useCase = new GenerateRecommendation(
    repository,
    new RecommendationService(),
    events,
    createLogger({ serviceName: "test" }),
    createFakeTracer(),
    clock.now,
  );
  const objective = unwrap(new ObjectiveBuilder().build());
  repository.save(objective);
  return { repository, publisher, useCase, objective };
}

describe("GenerateRecommendation", () => {
  it("returns an ordered action list: PAUSE first, then SCALE, then FIX/REFRESH", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const types = result.value.actions.map((a) => a.type);
      expect(types).toEqual(["PAUSE", "SCALE", "FIX", "REFRESH"]);
    }
  });

  it("PAUSE action targets the expensive ad (Rp/D3 > avg * 2.0)", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const pause = result.value.actions.find((a) => a.type === "PAUSE");
      expect(pause?.targetName).toContain("Promo Brio Akhir Bulan");
      expect(pause?.priority).toBe(1);
    }
  });

  it("SCALE action targets the cheap ad (Rp/D3 < avg * 0.7)", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-3",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const scale = result.value.actions.find((a) => a.type === "SCALE");
      expect(scale?.targetName).toContain("Gudangnya Xpander");
      expect(scale?.priority).toBe(2);
      expect(scale?.estimatedLeadGain).toBeGreaterThan(0);
    }
  });

  it("FIX action targets the FIX-verdict ad, REFRESH targets the REFRESH-verdict ad", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-4",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const fix = result.value.actions.find((a) => a.type === "FIX");
      const refresh = result.value.actions.find((a) => a.type === "REFRESH");
      expect(fix?.targetName).toContain("Fortuner Adventure");
      expect(refresh?.targetName).toContain("HRV Stylish Ride");
    }
  });

  it("emits RecommendationGenerated with correct actionCount/confidence", async () => {
    const { useCase, publisher, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-5",
    });
    expect(publisher.published.length).toBe(1);
    const payload = publisher.published[0]!.payload as { actionCount: number; confidence: number };
    expect(result.ok && payload.actionCount).toBe(result.value.actions.length);
    expect(result.ok && payload.confidence).toBe(result.value.confidence);
  });

  it("persists the recommendation via saveRecommendation", async () => {
    const { useCase, repository, objective } = setup();
    await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-6",
    });
    expect(repository.findLatestRecommendation(objective.id).some).toBe(true);
  });

  it("returns ObjectiveNotFoundError for an unknown objectiveId", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      objectiveId: ObjectiveId.generate(),
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-7",
    });
    expect(result.ok).toBe(false);
  });

  it("edge case: adAccount with 0 campaigns -> empty actions, 0 confidence, no SCALE candidates", async () => {
    const { useCase, objective } = setup();
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildEmptyAdAccountFixture(),
      correlationId: "corr-8",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actions).toEqual([]);
      expect(result.value.confidence).toBe(0);
    }
  });

  it("uses the real wall clock when no `now` is injected (default constructor param)", async () => {
    const repository = new InMemoryObjectiveRepository();
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    const useCase = new GenerateRecommendation(
      repository,
      new RecommendationService(),
      events,
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      // `now` intentionally omitted to exercise the default `() => new Date()`.
    );
    const objective = unwrap(new ObjectiveBuilder().build());
    repository.save(objective);
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-default-now",
    });
    expect(result.ok).toBe(true);
  });

  it("uses the latest recorded progress's currentHotLeads when computing targetGapClosedPercentage", async () => {
    const { repository, objective } = setup();
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    const clock = new TestClock("2026-08-09T00:00:00.000Z");
    const useCase = new GenerateRecommendation(
      repository,
      new RecommendationService(),
      events,
      createLogger({ serviceName: "test" }),
      createFakeTracer(),
      clock.now,
    );
    // No progress recorded yet -> service defaults currentHotLeads to 0 internally.
    const result = await useCase.execute({
      objectiveId: objective.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-9",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.estimatedImpact.targetGapClosedPercentage).toBeGreaterThanOrEqual(0);
    }
  });
});
