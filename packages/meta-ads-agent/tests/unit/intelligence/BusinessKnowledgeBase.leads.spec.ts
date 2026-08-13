import { AdDestinationType, Branch, CampaignObjective } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  AAOS_CAMPAIGN_DEFAULTS,
  FIX_OBJECTIVES,
} from "../../../src/intelligence/BusinessKnowledgeBase.js";

/**
 * AAOS-W1D-S3, coordinator note correction #4: `AAOS_CAMPAIGN_DEFAULTS`/`FIX_OBJECTIVES` are NEW
 * additions to `BusinessKnowledgeBase.ts` (neither existed before this supplement) — this file
 * pins their exact shape.
 */
describe("BusinessKnowledgeBase — AAOS_CAMPAIGN_DEFAULTS (AAOS-W1D-S3)", () => {
  it("objective is OUTCOME_LEADS (DSS Motor's real strategy — was OUTCOME_ENGAGEMENT)", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS.objective).toBe(CampaignObjective.OUTCOME_LEADS);
  });

  it("destinationType is WHATSAPP (CTWA — Jessy receives)", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS.destinationType).toBe(AdDestinationType.WHATSAPP);
  });

  it("optimizationGoal is LEAD_GENERATION", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS.optimizationGoal).toBe("LEAD_GENERATION");
  });

  it("billingEvent is IMPRESSIONS", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS.billingEvent).toBe("IMPRESSIONS");
  });

  it("callToAction is SEND_WHATSAPP_MESSAGE", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS.callToAction).toBe("SEND_WHATSAPP_MESSAGE");
  });

  it("does NOT include a ctwaDestination/phone-number field (coordinator note correction #6 — those come from MetaAdsAgentConfig, never hardcoded here)", () => {
    expect(AAOS_CAMPAIGN_DEFAULTS).not.toHaveProperty("ctwaDestination");
  });
});

describe("BusinessKnowledgeBase — FIX_OBJECTIVES (AAOS-W1D-S3)", () => {
  it("includes OUTCOME_ENGAGEMENT", () => {
    expect(FIX_OBJECTIVES).toContain(CampaignObjective.OUTCOME_ENGAGEMENT);
  });

  it("includes LINK_CLICKS", () => {
    expect(FIX_OBJECTIVES).toContain(CampaignObjective.LINK_CLICKS);
  });

  it("includes VISIT_INSTAGRAM_PROFILE", () => {
    expect(FIX_OBJECTIVES).toContain(CampaignObjective.VISIT_INSTAGRAM_PROFILE);
  });

  it("includes OUTCOME_SALES (coordinator note correction #1 — the spec's own hardcoded example list omitted this member)", () => {
    expect(FIX_OBJECTIVES).toContain(CampaignObjective.OUTCOME_SALES);
  });

  it("does NOT include OUTCOME_LEADS (the correct objective)", () => {
    expect(FIX_OBJECTIVES).not.toContain(CampaignObjective.OUTCOME_LEADS);
  });

  it("is derived from CampaignObjective, not a hand-maintained partial list — its length is exactly |CampaignObjective| - 1", () => {
    expect(FIX_OBJECTIVES).toHaveLength(Object.values(CampaignObjective).length - 1);
  });
});

describe("BusinessKnowledgeBase — MetaAdsAgentConfig.ctwaPhoneNumbers maps all 4 real branches (AAOS-W1D-S3)", () => {
  it("Branch has entries for BINTARO/CINERE/UMUM/BANDUNG that a real ctwaPhoneNumbers map can key off of", () => {
    // Config-level mapping is exercised end-to-end in MetaAdsAgentConfig.spec.ts and
    // CreativeBriefBuilder.ctwa.spec.ts; this test just pins that the 4 real DSS Motor branches
    // (per apps/aaos-api's PHONE_NUMBER_* env vars) are valid Branch members to key off of.
    const branches = [Branch.BINTARO, Branch.CINERE, Branch.UMUM, Branch.BANDUNG];
    for (const branch of branches) {
      expect(Object.values(Branch)).toContain(branch);
    }
  });
});
