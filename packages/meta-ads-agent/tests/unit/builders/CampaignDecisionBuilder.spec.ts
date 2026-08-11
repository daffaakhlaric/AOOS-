import { describe, expect, it } from "vitest";

import { CampaignDecisionBuilder } from "../../../src/builders/CampaignDecisionBuilder.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import type { PortfolioFinding } from "../../../src/types/AgentTypes.js";
import { unwrap } from "../../helpers/result.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const confidence = unwrap(ConfidenceScore.create(85));
const now = new Date("2026-08-09T00:00:00.000Z");

describe("CampaignDecisionBuilder.buildForPortfolio", () => {
  it("REALLOCATE_BUDGET within maxAutoReallocationIDR -> AUTO_EXECUTE", () => {
    const finding: PortfolioFinding = {
      key: "realloc:1",
      type: "REALLOCATE_BUDGET",
      description: "Realokasi dari Bandung ke Cinere",
      reallocationAmountIDR: 1_500_000,
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("REALLOCATE_BUDGET exceeding maxAutoReallocationIDR (Rp 2jt) -> ESCALATE", () => {
    const finding: PortfolioFinding = {
      key: "realloc:2",
      type: "REALLOCATE_BUDGET",
      description: "Realokasi besar",
      reallocationAmountIDR: 2_500_000,
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok && result.value.decisionType).toBe(DecisionType.ESCALATE);
  });

  it("CREATE_CAMPAIGN -> always ESCALATE", () => {
    const finding: PortfolioFinding = {
      key: "new-campaign:1",
      type: "CREATE_CAMPAIGN",
      description: "Usulan kampanye baru untuk Bandung",
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok && result.value.decisionType).toBe(DecisionType.ESCALATE);
    expect(result.ok && result.value.actionKind).toBe("CREATE_CAMPAIGN");
  });

  it("REALLOCATE_BUDGET without a reallocationAmountIDR defaults to Rp 0 (within the auto limit) -> AUTO_EXECUTE", () => {
    const finding: PortfolioFinding = {
      key: "realloc:5",
      type: "REALLOCATE_BUDGET",
      description: "x",
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
  });

  it("propagates a DecisionError when reallocationAmountIDR is fractional", () => {
    const finding: PortfolioFinding = {
      key: "realloc:4",
      type: "REALLOCATE_BUDGET",
      description: "x",
      reallocationAmountIDR: 100_000.5,
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok).toBe(false);
  });

  it("sets targetType to portfolio and targetId to the finding's key", () => {
    const finding: PortfolioFinding = {
      key: "realloc:3",
      type: "REALLOCATE_BUDGET",
      description: "x",
      reallocationAmountIDR: 100_000,
    };
    const result = CampaignDecisionBuilder.buildForPortfolio(finding, config, confidence, now);
    expect(result.ok && result.value.targetType).toBe("portfolio");
    expect(result.ok && result.value.targetId).toBe("realloc:3");
  });
});
