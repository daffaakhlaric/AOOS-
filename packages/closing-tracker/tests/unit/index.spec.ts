import { describe, expect, it } from "vitest";

import * as ClosingTracker from "../../src/index.js";

describe("public API surface (src/index.ts, spec 'Public API')", () => {
  it("exports ClosingTrackerFactory", () => {
    expect(ClosingTracker.ClosingTrackerFactory).toBeDefined();
  });

  it("exports every use case", () => {
    expect(ClosingTracker.GenerateClosingReport).toBeDefined();
    expect(ClosingTracker.GetCampaignAttribution).toBeDefined();
    expect(ClosingTracker.GetBranchPerformance).toBeDefined();
    expect(ClosingTracker.GetUnitPerformance).toBeDefined();
    expect(ClosingTracker.FeedToTamara).toBeDefined();
    expect(ClosingTracker.CheckObjectiveCompletion).toBeDefined();
    expect(ClosingTracker.GetClosingPipeline).toBeDefined();
  });

  it("exports ClosingAggregatorService and TamaraFeedService (spec-listed services)", () => {
    expect(ClosingTracker.ClosingAggregatorService).toBeDefined();
    expect(ClosingTracker.TamaraFeedService).toBeDefined();
  });

  it("exports AttributionEngineService and ReportGeneratorService (folder-structure services)", () => {
    expect(ClosingTracker.AttributionEngineService).toBeDefined();
    expect(ClosingTracker.ReportGeneratorService).toBeDefined();
  });

  it("exports both builders", () => {
    expect(ClosingTracker.ClosingReportBuilder).toBeDefined();
    expect(ClosingTracker.CampaignAttributionBuilder).toBeDefined();
  });

  it("exports ClosingTrackerError and InsufficientDataError (spec-listed errors)", () => {
    expect(ClosingTracker.ClosingTrackerError).toBeDefined();
    expect(ClosingTracker.InsufficientDataError).toBeDefined();
  });

  it("exports AttributionError (folder-structure error not in the spec's literal Public API list)", () => {
    expect(ClosingTracker.AttributionError).toBeDefined();
  });

  it("exports resolveVerdict for consumers that need the pure verdict function", () => {
    expect(ClosingTracker.resolveVerdict).toBeDefined();
    expect(
      ClosingTracker.resolveVerdict(1, 1, 1, {
        rphSpkScaleThreshold: 2,
        rphSpkKeepThreshold: 5,
        minSpendForPause: 1,
      }),
    ).toBe("SCALE");
  });

  it("exports config parsing helpers and defaults", () => {
    expect(ClosingTracker.parseClosingTrackerConfig).toBeDefined();
    expect(ClosingTracker.ClosingTrackerConfigSchema).toBeDefined();
    expect(ClosingTracker.DEFAULT_CLOSING_TRACKER_CONFIG).toBeDefined();
  });

  it("exports ClosingTrackerEvents", () => {
    expect(ClosingTracker.ClosingTrackerEvents).toBeDefined();
  });
});
