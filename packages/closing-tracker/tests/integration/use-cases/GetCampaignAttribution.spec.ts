import { ClosingType, SupabaseError } from "@aos/lead-store";
import { describe, expect, it } from "vitest";

import { AttributionEngineService } from "../../../src/application/services/AttributionEngineService.js";
import { ClosingAggregatorService } from "../../../src/application/services/ClosingAggregatorService.js";
import { ReportGeneratorService } from "../../../src/application/services/ReportGeneratorService.js";
import { GetCampaignAttribution } from "../../../src/application/use-cases/GetCampaignAttribution.js";
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

function buildUseCase(repo: FakeClosingRepository, spendByCampaign: Record<string, number> = {}) {
  const config = makeConfig();
  const aggregator = new ClosingAggregatorService(repo, makeGetClosingStats(repo, spendByCampaign));
  const engine = new AttributionEngineService(new FakeCampaignActivityProvider(), config);
  const reportGenerator = new ReportGeneratorService(aggregator, engine, config, fixedClock());
  return new GetCampaignAttribution(reportGenerator);
}

describe("GetCampaignAttribution (integration)", () => {
  it("returns every attributed campaign when no campaignId filter is given", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        campaignId: "#C1",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        campaignId: "#C2",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const useCase = buildUseCase(repo, { "#C1": 1_000_000, "#C2": 2_000_000 });

    const attributions = unwrap(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(attributions).toHaveLength(2);
  });

  it("narrows to a single campaign when campaignId is given", async () => {
    const repo = new FakeClosingRepository();
    repo.seed([
      makeClosing({
        campaignId: "#C1",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-01"),
      }),
      makeClosing({
        campaignId: "#C2",
        closingType: ClosingType.SPK,
        createdAt: new Date("2026-08-02"),
      }),
    ]);
    const useCase = buildUseCase(repo);

    const attributions = unwrap(
      await useCase.execute({ period: makePeriod(8, 2026), campaignId: "#C1" }),
    );
    expect(attributions).toHaveLength(1);
    expect(attributions[0]?.campaignId).toBe("#C1");
  });

  it("returns an empty array for a campaignId with no closings in the period", async () => {
    const repo = new FakeClosingRepository();
    const useCase = buildUseCase(repo);

    const attributions = unwrap(
      await useCase.execute({ period: makePeriod(8, 2026), campaignId: "#GHOST" }),
    );
    expect(attributions).toHaveLength(0);
  });

  it("propagates a report generation failure", async () => {
    const repo = new FakeClosingRepository();
    repo.forceError(new SupabaseError("down"));
    const useCase = buildUseCase(repo);

    const error = unwrapErr(await useCase.execute({ period: makePeriod(8, 2026) }));
    expect(error.message).toContain("down");
  });
});
