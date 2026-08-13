import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { GenerateClosingReport } from "../../../src/application/use-cases/GenerateClosingReport.js";
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

function buildUseCase(repo: FakeClosingRepository, milestones?: readonly number[]) {
  const config = makeConfig();
  const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
  const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
  const reportGenerator = new ReportGeneratorService(
    aggregator,
    engine,
    config,
    fixedClock(),
    () => "report-1",
  );
  const publisher = createFakePublisher();
  const events = new ClosingTrackerEvents(publisher);
  const useCase = new GenerateClosingReport(reportGenerator, events, fixedClock(), milestones);
  return { useCase, publisher };
}

describe("GenerateClosingReport (integration — mocked @aos/lead-store, real GetClosingStats)", () => {
  it("period Aug 2026 -> correct aggregation", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-10") }),
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-11") }),
    ]);
    const { useCase } = buildUseCase(repo);

    const report = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(report.totalSpk).toBe(1);
    expect(report.totalTestDrives).toBe(1);
  });

  it("emits ClosingReportGenerated", async () => {
    const repo = new FakeClosingRepository();
    const { useCase, publisher } = buildUseCase(repo);

    await useCase.execute({
      period: makePeriod(8, 2026),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const generated = publisher.published.find(
      (p) => p.type === "aaos.closing-tracker.report.generated",
    );
    expect(generated).toBeDefined();
    expect(generated?.tenantId).toBe("dss-motor");
  });

  it("emits MilestoneReached for every crossed threshold", async () => {
    const repo = new FakeClosingRepository();
    for (let i = 0; i < 10; i += 1) {
      repo.seed([
        makeClosing({
          closingType: ClosingType.SPK,
          createdAt: new Date(`2026-08-${String(i + 1).padStart(2, "0")}`),
        }),
      ]);
    }
    const { useCase, publisher } = buildUseCase(repo, [5, 10, 25]);

    await useCase.execute({
      period: makePeriod(8, 2026),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const milestones = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.milestone.reached",
    );
    expect(milestones).toHaveLength(2); // crosses 5 and 10, not 25
  });

  it("does not emit any MilestoneReached when no threshold is crossed", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-01") })]);
    const { useCase, publisher } = buildUseCase(repo, [10]);

    await useCase.execute({
      period: makePeriod(8, 2026),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const milestones = publisher.published.filter(
      (p) => p.type === "aaos.closing-tracker.milestone.reached",
    );
    expect(milestones).toHaveLength(0);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const { useCase } = buildUseCase(repo);

    const error = unwrapErr(
      await useCase.execute({
        period: makePeriod(8, 2026),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("down");
  });

  it("uses the real wall clock and default milestone thresholds when not overridden", async () => {
    const repo = new FakeClosingRepository();
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const publisher = createFakePublisher();
    const useCase = new GenerateClosingReport(reportGenerator, new ClosingTrackerEvents(publisher));

    const report = unwrap(
      await useCase.execute({
        period: makePeriod(8, 2026),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(report.totalSpk).toBe(0);
  });
});
