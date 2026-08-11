import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DecisionEngineService } from "../../../../src/application/services/DecisionEngineService.js";
import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../../src/config/MetaAdsAgentConfig.js";
import { VerdictDecisionEngine } from "../../../../src/intelligence/VerdictDecisionEngine.js";
import type { PerAdFinding, PortfolioFinding } from "../../../../src/types/AgentTypes.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const now = () => new Date("2026-08-09T00:00:00.000Z");

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad-1",
    targetId: "ad-1",
    targetType: "ad",
    verdict: Verdict.KEEP,
    branch: Branch.BINTARO,
    unit: "Xpander",
    spendIDR: 0,
    conversations: 0,
    rphChatIDR: null,
    rphD3IDR: null,
    ...overrides,
  };
}

describe("DecisionEngineService.decideAll", () => {
  it("combines per-ad and portfolio decisions into one ordered array", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const portfolio: PortfolioFinding = {
      key: "realloc:1",
      type: "REALLOCATE_BUDGET",
      description: "x",
      reallocationAmountIDR: 100_000,
    };
    const result = service.decideAll(
      {
        adFindings: [finding({ verdict: Verdict.FIX })],
        portfolioFindings: [portfolio],
        avgRphChatIDR: 9212,
        dataCoverageFraction: 1,
      },
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toHaveLength(2);
    expect(result.ok && result.value[0]?.actionKind).toBe("FIX");
    expect(result.ok && result.value[1]?.actionKind).toBe("REALLOCATE_BUDGET");
  });

  it("every decision shares the same per-cycle confidence, derived from data coverage", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const result = service.decideAll(
      {
        adFindings: [finding({ verdict: Verdict.FIX }), finding({ verdict: Verdict.KEEP })],
        portfolioFindings: [],
        avgRphChatIDR: 9212,
        dataCoverageFraction: 1,
      },
      config,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.confidence.toNumber()).toBe(100);
    expect(result.value[1]?.confidence.toNumber()).toBe(100);
  });

  it("propagates a DecisionError when dataCoverageFraction is non-finite", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const result = service.decideAll(
      {
        adFindings: [],
        portfolioFindings: [],
        avgRphChatIDR: 9212,
        dataCoverageFraction: Number.NaN,
      },
      config,
    );
    expect(result.ok).toBe(false);
  });

  it("propagates a per-ad decision-building failure", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const result = service.decideAll(
      {
        adFindings: [finding({ targetId: "" })],
        portfolioFindings: [],
        avgRphChatIDR: 9212,
        dataCoverageFraction: 1,
      },
      config,
    );
    expect(result.ok).toBe(false);
  });

  it("propagates a portfolio decision-building failure", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const badPortfolio: PortfolioFinding = {
      key: "",
      type: "CREATE_CAMPAIGN",
      description: "x",
    };
    const result = service.decideAll(
      {
        adFindings: [],
        portfolioFindings: [badPortfolio],
        avgRphChatIDR: 9212,
        dataCoverageFraction: 1,
      },
      config,
    );
    expect(result.ok).toBe(false);
  });

  it("uses the real wall clock when no clock is injected", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine());
    const result = service.decideAll(
      {
        adFindings: [],
        portfolioFindings: [
          {
            key: "realloc:1",
            type: "REALLOCATE_BUDGET",
            description: "x",
            reallocationAmountIDR: 1,
          },
        ],
        avgRphChatIDR: 0,
        dataCoverageFraction: 0,
      },
      config,
    );
    expect(result.ok).toBe(true);
  });

  it("returns an empty array for a cycle with no findings at all", () => {
    const service = new DecisionEngineService(new VerdictDecisionEngine(now), now);
    const result = service.decideAll(
      { adFindings: [], portfolioFindings: [], avgRphChatIDR: 0, dataCoverageFraction: 0 },
      config,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual([]);
  });
});
