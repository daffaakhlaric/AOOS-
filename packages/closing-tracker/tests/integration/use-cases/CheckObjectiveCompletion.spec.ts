import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { CheckObjectiveCompletion } from "../../../src/application/use-cases/CheckObjectiveCompletion.js";
import { ClosingTrackerEvents } from "../../../src/domain/events/ClosingTrackerEvents.js";
import {
  FakeCampaignActivityProvider,
  FakeClosingRepository,
  fixedClock,
  makeClosing,
  makeConfig,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function buildUseCase(achievedSpk: number) {
  const repo = new FakeClosingRepository();
  for (let i = 0; i < achievedSpk; i += 1) {
    const day = String((i % 28) + 1).padStart(2, "0");
    repo.seed([
      makeClosing({ closingType: ClosingType.SPK, createdAt: new Date(`2026-08-${day}`) }),
    ]);
  }
  const config = makeConfig();
  const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
  const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
  const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
  const publisher = createFakePublisher();
  const events = new ClosingTrackerEvents(publisher);
  const useCase = new CheckObjectiveCompletion(reportGenerator, events, fixedClock());
  return { useCase, publisher };
}

describe("CheckObjectiveCompletion (integration — pinned 49/50/51 boundary)", () => {
  it("50 SPK target, 50 achieved -> ObjectiveCompleted emitted", async () => {
    const { useCase, publisher } = buildUseCase(50);

    const output = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 50,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(output.completed).toBe(true);
    expect(output.achievedSpk).toBe(50);
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.objective.completed",
    );
    expect(events).toHaveLength(1);
  });

  it("50 SPK target, 49 achieved -> no event", async () => {
    const { useCase, publisher } = buildUseCase(49);

    const output = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 50,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(output.completed).toBe(false);
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.objective.completed",
    );
    expect(events).toHaveLength(0);
  });

  it("50 SPK target, 51 achieved -> ObjectiveCompleted emitted", async () => {
    const { useCase, publisher } = buildUseCase(51);

    const output = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 50,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(output.completed).toBe(true);
    const events = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.objective.completed",
    );
    expect(events).toHaveLength(1);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const publisher = createFakePublisher();
    const failingUseCase = new CheckObjectiveCompletion(
      reportGenerator,
      new ClosingTrackerEvents(publisher),
      fixedClock(),
    );

    const error = unwrapErr(
      await failingUseCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 50,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("down");
  });

  it("uses the real wall clock when no clock override is provided", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-01") })]);
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const publisher = createFakePublisher();
    const useCase = new CheckObjectiveCompletion(
      reportGenerator,
      new ClosingTrackerEvents(publisher),
    );

    const output = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        targetSpk: 1,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(output.completed).toBe(true);
  });
});
