import { BranchId } from "@aos/branch-manager";
import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { GetBranchPerformance } from "../../../src/application/use-cases/GetBranchPerformance.js";
import {
  FakeCampaignActivityProvider,
  FakeClosingRepository,
  fixedClock,
  makeClosing,
  makeConfig,
  makeGetClosingStats,
  makePeriod,
} from "../../fixtures/closingTrackerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("GetBranchPerformance (integration)", () => {
  it("returns per-branch stats for the period", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        branchId: BranchId.BINTARO,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        branchId: BranchId.CINERE,
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetBranchPerformance(reportGenerator);

    const performance = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(performance).toHaveLength(2);
    expect(performance.map((p) => p.branch).sort()).toEqual(
      [BranchId.BINTARO, BranchId.CINERE].sort(),
    );
  });

  it("returns an empty array for a period with no closings", async () => {
    const repo = new FakeClosingRepository();
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetBranchPerformance(reportGenerator);

    const performance = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(performance).toHaveLength(0);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetBranchPerformance(reportGenerator);

    const error = unwrapErr(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(error.message).toContain("down");
  });
});
