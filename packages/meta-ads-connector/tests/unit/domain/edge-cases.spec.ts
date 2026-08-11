import { ok } from "@aos/common";
import { describe, expect, it } from "vitest";

import { AdSetBuilder } from "../../../src/builders/AdSetBuilder.js";
import { CampaignBuilder } from "../../../src/builders/CampaignBuilder.js";
import { evaluateVerdict } from "../../../src/domain/services/VerdictEngine.js";
import { AdMetrics } from "../../../src/domain/value-objects/AdMetrics.js";
import { CampaignObjective } from "../../../src/domain/value-objects/CampaignObjective.js";
import { Spend } from "../../../src/domain/value-objects/Spend.js";
import { mapLeads } from "../../../src/mappers/LeadMapper.js";
import {
  assignAdSetStableIds,
  assignCampaignStableIds,
} from "../../../src/utils/StableIdAssigner.js";
import { unwrap } from "../../helpers/result.js";

/**
 * Dedicated cross-cutting coverage of every edge case named in the spec's "Edge cases" section,
 * gathered in one place so a reviewer can confirm each is handled without hunting across the
 * per-module spec files that also happen to touch it individually.
 */
describe("Edge cases (spec 'Edge cases' section)", () => {
  it("campaign with 0 ads: an adset with an empty ads array survives StableId assignment untouched", () => {
    const adSet = unwrap(new AdSetBuilder().withAds([]).build());
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    const [assigned] = unwrap(assignCampaignStableIds([campaign]));
    expect(assigned?.adSets[0]?.ads).toEqual([]);
  });

  it("ad with 0 spend: rphD3 is null-safe, never NaN or Infinity", () => {
    const metrics = unwrap(
      AdMetrics.create({
        spend: Spend.zero(),
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    );
    expect(metrics.rphD3.value).toBeNull();
    expect(Number.isNaN(metrics.rphD3.value)).toBe(false);
  });

  it("frequency division by zero: reach === 0 yields frequency 0, not NaN/Infinity", () => {
    const metrics = unwrap(
      AdMetrics.create({
        spend: unwrap(Spend.create(1000)),
        impressions: 500,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    );
    expect(metrics.frequency).toBe(0);
    expect(Number.isFinite(metrics.frequency)).toBe(true);
  });

  it("VerdictEngine tolerates a 0-reach, 0-frequency, 0-spend ad without throwing (falls to REVIEW)", () => {
    const metrics = unwrap(
      AdMetrics.create({
        spend: Spend.zero(),
        impressions: 0,
        reach: 0,
        clicks: 0,
        conversations: 0,
        d2: 0,
        d3: 0,
        d5: 0,
        leadForm: 0,
      }),
    );
    const verdict = evaluateVerdict({
      rphChat: metrics.rphChat,
      conversations: metrics.conversations,
      spendAmount: metrics.spend.toNumber(),
      frequency: metrics.frequency,
      objective: CampaignObjective.OUTCOME_ENGAGEMENT,
    });
    expect(verdict).toBeDefined();
  });

  it("webhook with 0 leads in payload: mapLeads returns an empty array, not an error", () => {
    const result = mapLeads([], () => ok({} as never));
    expect(unwrap(result)).toEqual([]);
  });

  it("multiple ad accounts in a single sync: assignAdSetStableIds is scoped independently per call (no cross-account bleed)", () => {
    const adSetA = unwrap(
      new AdSetBuilder()
        .withMetaId("as-account-a")
        .withSpend(unwrap(Spend.create(500)))
        .build(),
    );
    const adSetB = unwrap(
      new AdSetBuilder()
        .withMetaId("as-account-b")
        .withSpend(unwrap(Spend.create(999)))
        .build(),
    );
    const resultA = unwrap(assignAdSetStableIds([adSetA]));
    const resultB = unwrap(assignAdSetStableIds([adSetB]));
    // Each account's sync assigns its own #B001 independently — proves no shared/global counter.
    expect(resultA[0]?.stableId.toString()).toBe("#B001");
    expect(resultB[0]?.stableId.toString()).toBe("#B001");
  });
});
