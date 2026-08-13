import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { GetUnitPerformance } from "../../../src/application/use-cases/GetUnitPerformance.js";
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

describe("GetUnitPerformance (integration)", () => {
  it("returns per-unit-model stats for the period", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        unitModel: "Xpander Cross",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        unitModel: "Pajero Sport",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetUnitPerformance(reportGenerator);

    const performance = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(performance.map((p) => p.unitModel).sort()).toEqual(["Pajero Sport", "Xpander Cross"]);
  });

  it("a unit model with only non-SPK closings reports avgSpkValue/avgCommission of 0", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        unitModel: "Xpander Cross",
        closingType: ClosingType.TEST_DRIVE,
        createdAt: new Date("2026-08-01"),
      }),
    ]);
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetUnitPerformance(reportGenerator);

    const performance = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(performance[0]?.avgSpkValue).toBe(0);
    expect(performance[0]?.avgCommission).toBe(0);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const config = makeConfig();
    const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo));
    const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
    const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
    const useCase = new GetUnitPerformance(reportGenerator);

    const error = unwrapErr(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(error.message).toContain("down");
  });
});
