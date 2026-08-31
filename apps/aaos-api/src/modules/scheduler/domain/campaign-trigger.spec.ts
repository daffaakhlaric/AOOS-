import { describe, expect, it } from "vitest";

import {
  HIGH_CPL_MULTIPLIER,
  HIGH_FREQUENCY_THRESHOLD,
  NEW_LISTING_WINDOW_MS,
  shouldCreateNewCampaign,
  type ListingCampaignSignals,
} from "./campaign-trigger.js";

const NOW = new Date("2026-08-31T00:00:00.000Z");

function baseSignals(overrides: Partial<ListingCampaignSignals> = {}): ListingCampaignSignals {
  return {
    listingId: "listing-1",
    listingCreatedAt: new Date("2026-01-01T00:00:00.000Z"),
    hasActiveCampaign: true,
    ...overrides,
  };
}

describe("shouldCreateNewCampaign", () => {
  it("no trigger fires when there's an active campaign, no fatigue, and CPL is at/below benchmark", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: true,
        maxFrequency: 2.1,
        cplIDR: 50_000,
        benchmarkCplIDR: 50_000,
      }),
      NOW,
    );
    expect(decision).toEqual({ shouldCreate: false, reasons: [] });
  });

  it("NO_ACTIVE_CAMPAIGN fires for a listing with no active campaign, created well outside the new-listing window", () => {
    const oldEnough = new Date(NOW.getTime() - NEW_LISTING_WINDOW_MS - 60_000);
    const decision = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: false, listingCreatedAt: oldEnough }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reasons).toEqual(["NO_ACTIVE_CAMPAIGN"]);
  });

  it("NEW_LISTING_WITHOUT_CAMPAIGN fires for a listing with no active campaign created within the new-listing window", () => {
    const justCreated = new Date(NOW.getTime() - 1_000);
    const decision = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: false, listingCreatedAt: justCreated }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reasons).toEqual(["NEW_LISTING_WITHOUT_CAMPAIGN"]);
  });

  it("NEW_LISTING_WITHOUT_CAMPAIGN and NO_ACTIVE_CAMPAIGN are mutually exclusive at the exact window boundary", () => {
    const exactlyAtWindow = new Date(NOW.getTime() - NEW_LISTING_WINDOW_MS);
    const atBoundary = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: false, listingCreatedAt: exactlyAtWindow }),
      NOW,
    );
    expect(atBoundary.reasons).toEqual(["NEW_LISTING_WITHOUT_CAMPAIGN"]);

    const justPastWindow = new Date(NOW.getTime() - NEW_LISTING_WINDOW_MS - 1);
    const pastBoundary = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: false, listingCreatedAt: justPastWindow }),
      NOW,
    );
    expect(pastBoundary.reasons).toEqual(["NO_ACTIVE_CAMPAIGN"]);
  });

  it("HIGH_FREQUENCY fires when maxFrequency exceeds the reused meta-ads-agent fatigue threshold (3.5)", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: true,
        maxFrequency: HIGH_FREQUENCY_THRESHOLD + 0.1,
      }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reasons).toEqual(["HIGH_FREQUENCY"]);
  });

  it("HIGH_FREQUENCY does not fire at exactly the threshold (strictly greater-than)", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: true, maxFrequency: HIGH_FREQUENCY_THRESHOLD }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(false);
  });

  it("HIGH_CPL fires when cplIDR exceeds benchmarkCplIDR * 1.5", () => {
    const benchmarkCplIDR = 40_000;
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: true,
        cplIDR: benchmarkCplIDR * HIGH_CPL_MULTIPLIER + 1,
        benchmarkCplIDR,
      }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reasons).toEqual(["HIGH_CPL"]);
  });

  it("HIGH_CPL does not fire at exactly the multiplier boundary (strictly greater-than)", () => {
    const benchmarkCplIDR = 40_000;
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: true,
        cplIDR: benchmarkCplIDR * HIGH_CPL_MULTIPLIER,
        benchmarkCplIDR,
      }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(false);
  });

  it("HIGH_CPL never fires without a real benchmark (undefined benchmarkCplIDR)", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({ hasActiveCampaign: true, cplIDR: 1_000_000 }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(false);
  });

  it("multiple real conditions can fire together on the same listing", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: true,
        maxFrequency: 5,
        cplIDR: 200_000,
        benchmarkCplIDR: 50_000,
      }),
      NOW,
    );
    expect(decision.shouldCreate).toBe(true);
    expect(decision.reasons).toEqual(["HIGH_FREQUENCY", "HIGH_CPL"]);
  });

  it("never implements a 5th 'opportunity score' condition — CampaignTriggerReason has exactly the 4 real reasons", () => {
    const decision = shouldCreateNewCampaign(
      baseSignals({
        hasActiveCampaign: false,
        listingCreatedAt: new Date(0),
        maxFrequency: 10,
        cplIDR: 1_000_000,
        benchmarkCplIDR: 1,
      }),
      NOW,
    );
    const allowedReasons = [
      "NO_ACTIVE_CAMPAIGN",
      "NEW_LISTING_WITHOUT_CAMPAIGN",
      "HIGH_FREQUENCY",
      "HIGH_CPL",
    ];
    for (const reason of decision.reasons) {
      expect(allowedReasons).toContain(reason);
    }
  });
});
