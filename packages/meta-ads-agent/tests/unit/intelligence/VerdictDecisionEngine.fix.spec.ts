import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { VerdictDecisionEngine } from "../../../src/intelligence/VerdictDecisionEngine.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { unwrap } from "../../helpers/result.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const confidence = unwrap(ConfidenceScore.create(90));
const engine = new VerdictDecisionEngine(() => new Date("2026-08-09T00:00:00.000Z"));

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad-1",
    targetId: "ad-1",
    targetType: "ad",
    verdict: Verdict.FIX,
    branch: Branch.BINTARO,
    unit: "Xpander Cross 2019",
    spendIDR: 100_000,
    conversations: 5,
    rphChatIDR: 5_000,
    rphD3IDR: 5_000,
    ...overrides,
  };
}

/**
 * AAOS-W1D-S3, coordinator note correction #2: `VerdictDecisionEngine.decideForAd`'s `case
 * Verdict.FIX` branch does NOT independently decide FIX by objective — it takes an
 * ALREADY-COMPUTED `finding.verdict` (produced upstream by `@aos/meta-ads-connector`'s
 * `VerdictEngine.evaluateVerdict`, expanded in this same supplement — see
 * `VerdictEngine.objective.spec.ts`) and only decides the EXECUTION STRATEGY for it, which was
 * already generic ("FIX: always AUTO_EXECUTE") before this supplement and needed NO CHANGE.
 * This file exists to make that "no change needed" verified, not assumed — pinning that FIX
 * always resolves to AUTO_EXECUTE regardless of which now-real-world objective produced it
 * upstream (OUTCOME_ENGAGEMENT, LINK_CLICKS, VISIT_INSTAGRAM_PROFILE, OUTCOME_SALES — every
 * connector-side FIX trigger funnels through the same generic branch here), and that this engine
 * has no objective-aware branching of its own to add.
 */
describe("VerdictDecisionEngine — FIX branch is objective-agnostic by design (AAOS-W1D-S3, correction #2)", () => {
  it("Verdict.FIX always resolves to actionKind FIX / DecisionType.AUTO_EXECUTE", () => {
    const result = engine.decideForAd(finding({ verdict: Verdict.FIX }), 5_000, config, confidence);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.actionKind).toBe("FIX");
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("resolves the same way for a FIX finding at every branch (no per-objective/per-branch special-casing)", () => {
    const branches = [Branch.BINTARO, Branch.CINERE, Branch.BANDUNG, Branch.UMUM];
    for (const branch of branches) {
      const result = engine.decideForAd(
        finding({ verdict: Verdict.FIX, branch }),
        5_000,
        config,
        confidence,
      );
      expect(result.ok).toBe(true);
      expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    }
  });

  it("FIX ignores rphChat/spend/conversations entirely — even PAUSE-shaped metrics still resolve to FIX/AUTO_EXECUTE", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.FIX, spendIDR: 500_000, conversations: 0, rphChatIDR: 999_999 }),
      5_000,
      config,
      confidence,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.actionKind).toBe("FIX");
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });
});
