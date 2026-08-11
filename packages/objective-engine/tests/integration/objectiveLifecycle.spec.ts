import { AdAccountId, CampaignBuilder, Spend, type AdAccount } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DEFAULT_OBJECTIVE_ENGINE_CONFIG } from "../../src/config/ObjectiveEngineConfig.js";
import { ObjectiveStatus } from "../../src/domain/value-objects/ObjectiveStatus.js";
import {
  ObjectiveEngineFactory,
  type ObjectiveEngine,
} from "../../src/factories/ObjectiveEngineFactory.js";
import {
  buildAdAccountFixture,
  buildEmptyAdAccountFixture,
} from "../fixtures/adAccountFixtures.js";
import { TestClock } from "../helpers/clock.js";
import { createFakePublisher, type FakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";

function config() {
  return { tenantId: "dss-motor", ...DEFAULT_OBJECTIVE_ENGINE_CONFIG };
}

function buildEngine(startISO: string): {
  engine: ObjectiveEngine;
  clock: TestClock;
  publisher: FakePublisher;
} {
  const clock = new TestClock(startISO);
  const publisher = createFakePublisher();
  const engine = ObjectiveEngineFactory.create({
    config: config(),
    publisher,
    now: clock.now,
  });
  return { engine, clock, publisher };
}

function adAccountWithSpend(spend: number): AdAccount {
  const campaign = unwrap(new CampaignBuilder().withSpend(unwrap(Spend.create(spend))).build());
  return {
    id: unwrap(AdAccountId.create("act_1")),
    name: "DSS Motor",
    businessManagerId: "bm_1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    campaigns: [campaign],
    syncedAt: new Date("2026-08-08T00:00:00.000Z"),
  } as unknown as AdAccount;
}

describe("Objective full lifecycle (create -> activate -> progress -> recommend -> complete)", () => {
  it("walks through the entire happy path with correct state transitions and events", async () => {
    const { engine, clock, publisher } = buildEngine("2026-08-01T00:00:00.000Z");

    // 1. Create
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander", "Brio"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-create",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe(ObjectiveStatus.DRAFT);
    expect(publisher.published.some((p) => p.type === "aaos.objective.created")).toBe(true);

    // 2. Activate — no dedicated use case exists (spec lists no ActivateObjective use case); the
    // domain entity itself exposes `activate()`, exercised directly here plus re-saved via the
    // repository, mirroring how a future orchestrating caller would drive the transition.
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);
    expect(engine.getObjective.execute({ objectiveId: activated.id }).ok && true).toBe(true);
    const afterActivate = engine.getObjective.execute({ objectiveId: activated.id });
    expect(afterActivate.ok && afterActivate.value.status).toBe(ObjectiveStatus.ACTIVE);

    // 3. Update progress across multiple simulated days
    clock.advanceDays(8); // day 9
    const progress1 = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-progress-1",
    });
    expect(progress1.ok).toBe(true);
    if (progress1.ok) {
      expect(progress1.value.daysElapsed).toBe(9);
      expect(progress1.value.onTrackStatus).toBe("AT_RISK");
    }

    clock.advanceDays(6); // day 15
    const progress2 = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 25,
      correlationId: "corr-progress-2",
    });
    expect(progress2.ok).toBe(true);
    if (progress2.ok) {
      expect(progress2.value.daysElapsed).toBe(15);
      expect(progress2.value.currentHotLeads).toBe(25);
    }

    // 4. Generate recommendation
    const recommendation = await engine.generateRecommendation.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-recommend",
    });
    expect(recommendation.ok).toBe(true);
    if (recommendation.ok) {
      expect(recommendation.value.actions.length).toBeGreaterThan(0);
    }
    expect(publisher.published.some((p) => p.type === "aaos.objective.recommendation")).toBe(true);

    // 5. Complete — hitting 100% target via UpdateProgress
    clock.advanceDays(10); // day 25
    const completion = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 50,
      correlationId: "corr-complete",
    });
    expect(completion.ok).toBe(true);
    const finalObjective = engine.getObjective.execute({ objectiveId: activated.id });
    expect(finalObjective.ok && finalObjective.value.status).toBe(ObjectiveStatus.COMPLETED);
    expect(publisher.published.some((p) => p.type === "aaos.objective.completed")).toBe(true);
  });

  it("edge case: objective created on the last day of the month is still valid and trackable", async () => {
    const { engine, clock } = buildEngine("2026-08-31T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    const progress = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 0,
      correlationId: "corr-2",
    });
    expect(progress.ok).toBe(true);
    if (progress.ok) {
      expect(progress.value.daysElapsed).toBe(31);
      expect(progress.value.daysRemaining).toBe(0);
      expect(progress.value.onTrackStatus).toBe("OFF_TRACK");
      expect(Number.isFinite(progress.value.dailyRunRate)).toBe(true);
      expect(Number.isFinite(progress.value.requiredDailyRunRate)).toBe(true);
    }
  });

  it("edge case: zero hot leads after 15 days -> OFF_TRACK and ObjectiveOffTrack emitted", async () => {
    const { engine, clock, publisher } = buildEngine("2026-08-01T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    clock.advanceDays(14); // day 15
    const progress = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 0,
      correlationId: "corr-2",
    });
    expect(progress.ok && progress.value.onTrackStatus).toBe("OFF_TRACK");
    expect(publisher.published.some((p) => p.type === "aaos.objective.off-track")).toBe(true);
  });

  it("edge case: budget exhausted before month ends is reflected in the forecast", async () => {
    const { engine, clock } = buildEngine("2026-08-09T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 9_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    const forecast = await engine.forecastObjective.execute({
      objectiveId: activated.id,
      adAccount: adAccountWithSpend(3_490_000),
      hotLeadsToDate: 12,
    });
    expect(forecast.ok).toBe(true);
    if (forecast.ok) {
      expect(forecast.value.budgetExhaustedAt).toBeDefined();
    }
  });

  it("edge case: 100% target hit early transitions the Objective to COMPLETED immediately", async () => {
    const { engine, clock } = buildEngine("2026-08-03T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 10,
      budgetAllocation: 5_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    const progress = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 10,
      correlationId: "corr-2",
    });
    expect(progress.ok).toBe(true);
    const stored = engine.getObjective.execute({ objectiveId: activated.id });
    expect(stored.ok && stored.value.status).toBe(ObjectiveStatus.COMPLETED);
  });

  it("edge case: no ads with SCALE verdict available -> recommendation still generated without a SCALE action", async () => {
    const { engine, clock } = buildEngine("2026-08-09T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    const recommendation = await engine.generateRecommendation.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(), // 0 campaigns -> 0 candidates of any kind
      correlationId: "corr-2",
    });
    expect(recommendation.ok).toBe(true);
    if (recommendation.ok) {
      expect(recommendation.value.actions.some((a) => a.type === "SCALE")).toBe(false);
    }
  });

  it("edge case: adAccount with 0 campaigns is handled end-to-end (progress + recommendation)", async () => {
    const { engine, clock } = buildEngine("2026-08-09T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    const progress = await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(),
      hotLeadsCount: 5,
      correlationId: "corr-2",
    });
    expect(progress.ok && progress.value.currentSpend.toNumber()).toBe(0);

    const recommendation = await engine.generateRecommendation.execute({
      objectiveId: activated.id,
      adAccount: buildEmptyAdAccountFixture(),
      correlationId: "corr-3",
    });
    expect(recommendation.ok && recommendation.value.actions).toEqual([]);
  });

  it("registry reflects the latest progress/recommendation snapshots throughout the lifecycle", async () => {
    const { engine, clock } = buildEngine("2026-08-09T00:00:00.000Z");
    const created = await engine.createObjective.execute({
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const activated = created.value.activate(clock.now());
    engine.repository.save(activated);

    expect(engine.registry.getProgress(activated.id).some).toBe(false);
    await engine.updateProgress.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      hotLeadsCount: 12,
      correlationId: "corr-2",
    });
    expect(engine.registry.getProgress(activated.id).some).toBe(true);

    expect(engine.registry.getRecommendation(activated.id).some).toBe(false);
    await engine.generateRecommendation.execute({
      objectiveId: activated.id,
      adAccount: buildAdAccountFixture(),
      correlationId: "corr-3",
    });
    expect(engine.registry.getRecommendation(activated.id).some).toBe(true);

    expect(engine.registry.listByTenant("dss-motor")).toContain(activated);
  });
});
