import { ClosingType, LeadId, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { GetClosingPipeline } from "../../../src/application/use-cases/GetClosingPipeline.js";
import {
  FakeClosingRepository,
  makeClosing,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetClosingPipeline (integration)", () => {
  it("computes the test-drive -> SPK funnel for the period", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-01") }),
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-02") }),
      makeClosing({ closingType: ClosingType.SPK, createdAt: new Date("2026-08-03") }),
      makeClosing({ closingType: ClosingType.CANCELLED, createdAt: new Date("2026-08-04") }),
    ]);
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const useCase = new GetClosingPipeline(aggregator);

    const pipeline = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(pipeline.totalTestDrives).toBe(2);
    expect(pipeline.totalSpk).toBe(1);
    expect(pipeline.totalCancelled).toBe(1);
  });

  it("computes avgDaysTestDriveToSpk for leads with both timestamps", async () => {
    const repo = new FakeClosingRepository();
    const leadId = LeadId.generate();
    const testDriveAt = new Date("2026-08-01T00:00:00.000Z");
    const spkAt = new Date("2026-08-05T00:00:00.000Z");
    repo.seed([
      makeClosing({
        leadId,
        closingType: ClosingType.TEST_DRIVE,
        testDriveAt,
        createdAt: testDriveAt,
      }),
      makeClosing({ leadId, closingType: ClosingType.SPK, spkAt, createdAt: spkAt }),
    ]);
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const useCase = new GetClosingPipeline(aggregator);

    const pipeline = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(pipeline.avgDaysTestDriveToSpk).toBe(4);
  });

  it("avgDaysTestDriveToSpk is 0 when no lead has both timestamps", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({ closingType: ClosingType.TEST_DRIVE, createdAt: new Date("2026-08-01") }),
    ]);
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const useCase = new GetClosingPipeline(aggregator);

    const pipeline = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(pipeline.avgDaysTestDriveToSpk).toBe(0);
  });

  it("funnel hotLeadCount reflects distinct leads in the period", async () => {
    const repo = new FakeClosingRepository();
    const leadId = LeadId.generate();
    repo.seed([
      makeClosing({
        leadId,
        closingType: ClosingType.TEST_DRIVE,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({ leadId, closingType: ClosingType.SPK, createdAt: new Date("2026-08-02") }),
    ]);
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const useCase = new GetClosingPipeline(aggregator);

    const pipeline = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(pipeline.funnel.hotLeadCount).toBe(1);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const useCase = new GetClosingPipeline(aggregator);

    const error = unwrapErr(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(error.message).toContain("down");
  });
});
