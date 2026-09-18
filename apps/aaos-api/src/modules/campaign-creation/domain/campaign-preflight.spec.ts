import { CampaignObjective } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import type { FeasibilityResult } from "../../growth-objectives/domain/feasibility.js";

import type { CampaignBlueprint } from "./campaign-blueprint.js";
import {
  assessCampaignPreflight,
  CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS,
} from "./campaign-preflight.js";
import type { ListingReadinessResult } from "./listing-readiness.js";

const READY_LISTING_READINESS: ListingReadinessResult = {
  listingId: "listing-1",
  ready: true,
  checks: [],
  blockingIssues: [],
  skippedChecks: [],
};

const NOT_READY_LISTING_READINESS: ListingReadinessResult = {
  listingId: "listing-1",
  ready: false,
  checks: [],
  blockingIssues: ["Belum ada nomor WhatsApp destination pada listing ini."],
  skippedChecks: [],
};

function makeCompleteBlueprint(overrides: Partial<CampaignBlueprint> = {}): CampaignBlueprint {
  return {
    tenantId: "dss-motor",
    growthObjectiveId: "objective-1",
    listingId: "listing-1",
    goal: "GENERATE_HOT_LEADS",
    destination: "WHATSAPP",
    campaign: {
      name: "Samantha-RUMAH-Rumah-objective",
      objective: CampaignObjective.OUTCOME_LEADS,
      buyingType: "AUCTION",
      initialStatus: "PAUSED",
    },
    adSet: {
      name: "Samantha-RUMAH-Rumah-objective-adset",
      dailyBudgetIdr: 200_000,
      optimizationGoal: "LEAD_GENERATION",
      audienceStrategy: "SAMANTHA",
      geo: { city: "Tangerang Selatan" },
      placements: [],
    },
    creativeStrategy: { formats: ["IMAGE"], kaiBriefId: null },
    warnings: [],
    ...overrides,
  };
}

const ACHIEVABLE: FeasibilityResult = {
  status: "ACHIEVABLE",
  confidence: 0.8,
  reasons: ["Kebutuhan pace masih jauh di bawah kapasitas saat ini."],
  options: [],
};

describe("assessCampaignPreflight", () => {
  it("all-pass case: ready listing + achievable feasibility + complete blueprint -> ready: true, no blocking errors", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: ACHIEVABLE,
    });
    expect(result.ready).toBe(true);
    expect(result.blockingErrors).toEqual([]);
    expect(result.checks.every((check) => check.passed)).toBe(true);
  });

  it("always reports the same honest skippedChecks list (no real Meta-account/billing/tracking data source)", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: ACHIEVABLE,
    });
    expect(result.skippedChecks).toEqual(CAMPAIGN_PREFLIGHT_SKIPPED_CHECKS);
  });

  it("not ready: blocks when listing readiness failed, with its blockingIssues surfaced", () => {
    const result = assessCampaignPreflight({
      listingReadiness: NOT_READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: ACHIEVABLE,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingErrors).toContain(
      "Belum ada nomor WhatsApp destination pada listing ini.",
    );
  });

  it("not ready: blocks when feasibility is undefined (objective never analyzed) — never assumed feasible", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: undefined,
    });
    expect(result.ready).toBe(false);
    const feasibilityCheck = result.checks.find((c) => c.name === "feasibility");
    expect(feasibilityCheck?.passed).toBe(false);
    expect(result.blockingErrors[0]).toMatch(/belum dianalisa/);
  });

  it("not ready: blocks when feasibility is UNLIKELY", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: {
        status: "UNLIKELY",
        confidence: 0.5,
        reasons: ["jauh melebihi kapasitas"],
        options: [],
      },
    });
    expect(result.ready).toBe(false);
  });

  it("not ready: blocks when feasibility is INSUFFICIENT_DATA", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: {
        status: "INSUFFICIENT_DATA",
        confidence: 0,
        reasons: ["data historis kurang"],
        options: [],
      },
    });
    expect(result.ready).toBe(false);
  });

  it("passes but adds a warning when feasibility is AT_RISK (proceed, watched — not a hard stop)", () => {
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: makeCompleteBlueprint(),
      feasibility: {
        status: "AT_RISK",
        confidence: 0.6,
        reasons: ["Kebutuhan pace melebihi kapasitas saat ini."],
        options: ["INCREASE_BUDGET"],
      },
    });
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain("Kebutuhan pace melebihi kapasitas saat ini.");
  });

  it("not ready: blocks when the blueprint is incomplete (no destination, no budget, no creative formats)", () => {
    const incomplete = makeCompleteBlueprint({
      destination: undefined,
      adSet: {
        name: "adset",
        optimizationGoal: "LEAD_GENERATION",
        audienceStrategy: "SAMANTHA",
        geo: {},
        placements: [],
      },
      creativeStrategy: { formats: [], kaiBriefId: null },
    });
    const result = assessCampaignPreflight({
      listingReadiness: READY_LISTING_READINESS,
      blueprint: incomplete,
      feasibility: ACHIEVABLE,
    });
    expect(result.ready).toBe(false);
    const blueprintCheck = result.checks.find((c) => c.name === "blueprintCompleteness");
    expect(blueprintCheck?.passed).toBe(false);
    expect(blueprintCheck?.reasons).toHaveLength(3);
  });

  it("multiple failing reasons: readiness + feasibility + blueprint can all fail at once, accumulating every blockingError", () => {
    const incomplete = makeCompleteBlueprint({ destination: undefined });
    const result = assessCampaignPreflight({
      listingReadiness: NOT_READY_LISTING_READINESS,
      blueprint: incomplete,
      feasibility: undefined,
    });
    expect(result.ready).toBe(false);
    expect(result.checks.filter((c) => !c.passed)).toHaveLength(3);
    expect(result.blockingErrors.length).toBeGreaterThanOrEqual(3);
  });
});
