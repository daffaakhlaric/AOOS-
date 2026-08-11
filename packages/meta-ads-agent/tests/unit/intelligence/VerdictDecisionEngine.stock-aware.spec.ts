import { Branch, Verdict } from "@aos/meta-ads-connector";
import {
  ScrapedKilometer,
  ScrapedPrice,
  ScrapeTimestamp,
  ScrapedUnit,
  UnitUrl,
} from "@aos/mobix-web-scraper";
import { describe, expect, it } from "vitest";

import { DEFAULT_META_ADS_AGENT_CONFIG } from "../../../src/config/MetaAdsAgentConfig.js";
import { AgentMemory } from "../../../src/domain/entities/AgentMemory.js";
import { ConfidenceScore } from "../../../src/domain/value-objects/ConfidenceScore.js";
import { DecisionType } from "../../../src/domain/value-objects/DecisionType.js";
import { VerdictDecisionEngine } from "../../../src/intelligence/VerdictDecisionEngine.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";
import { unwrap } from "../../helpers/result.js";

const config = { tenantId: "dss-motor", ...DEFAULT_META_ADS_AGENT_CONFIG };
const confidence = unwrap(ConfidenceScore.create(90));
const engine = new VerdictDecisionEngine(() => new Date("2026-08-09T00:00:00.000Z"));
const clock = () => new Date("2026-08-09T00:00:00.000Z");

function unit(model: string, branch: Branch): ScrapedUnit {
  return unwrap(
    ScrapedUnit.create({
      url: unwrap(
        UnitUrl.create(`https://mobixbydss.id/unit/${model.toLowerCase().replace(/\s+/g, "-")}`),
      ),
      model,
      brand: "Hyundai",
      year: 2022,
      transmission: "AT",
      color: "Hitam",
      kilometer: unwrap(ScrapedKilometer.create(10_000)),
      price: unwrap(ScrapedPrice.create(250_000_000)),
      branch,
      photos: [],
      available: true,
      scrapedAt: ScrapeTimestamp.now(clock),
    }),
  );
}

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad-1",
    targetId: "ad-1",
    targetType: "ad",
    verdict: Verdict.SCALE,
    branch: Branch.BANDUNG,
    unit: "Stargazer",
    spendIDR: 1_000_000,
    conversations: 5,
    rphChatIDR: null,
    rphD3IDR: null,
    budgetIncreaseIDR: 100_000,
    currentDailyBudgetIDR: 500_000,
    ...overrides,
  };
}

describe("VerdictDecisionEngine — S2 stock-aware override (pinned business-correctness)", () => {
  it('Stargazer Bandung: 0 units in inventory (present elsewhere) — SCALE verdict overrides to AUTO_EXECUTE/"PAUSE" and the reason names both "Stargazer" and "Bandung"', () => {
    const memory = new AgentMemory();
    memory.seedInventory([unit("Stargazer", Branch.CINERE)], clock());

    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "Stargazer", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
      memory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actionKind).toBe("PAUSE");
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
      expect(result.value.reason.toString()).toContain("Stargazer");
      expect(result.value.reason.toString()).toContain(Branch.BANDUNG);
    }
  });

  it("a unit in stock at the ad's own branch is scaled normally (no override)", () => {
    const memory = new AgentMemory();
    memory.seedInventory([unit("Stargazer", Branch.BANDUNG)], clock());

    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "Stargazer", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
      memory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actionKind).toBe("SCALE");
      expect(result.value.decisionType).toBe(DecisionType.AUTO_EXECUTE);
    }
  });

  it("an entirely untracked unit model (never scraped) is assumed in stock — scaled normally", () => {
    const memory = new AgentMemory();
    memory.seedInventory([unit("Xpander", Branch.BINTARO)], clock());

    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "Rush", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
      memory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.actionKind).toBe("SCALE");
  });

  it("a blank/whitespace-only detected unit name never triggers the stock check", () => {
    const memory = new AgentMemory();
    memory.seedInventory([unit("Stargazer", Branch.CINERE)], clock());
    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "   ", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.actionKind).toBe("SCALE");
  });

  it("no memory supplied -> stock check never triggers (backward-compatible default)", () => {
    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "Stargazer", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.actionKind).toBe("SCALE");
  });

  it("empty inventory (S2 never scraped) -> stock check never triggers", () => {
    const memory = new AgentMemory();
    const result = engine.decideForAd(
      finding({ verdict: Verdict.SCALE, unit: "Stargazer", branch: Branch.BANDUNG }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.actionKind).toBe("SCALE");
  });

  it("budget-increase-over-threshold SCALE decisions still ESCALATE normally when stock is fine", () => {
    const memory = new AgentMemory();
    memory.seedInventory([unit("Stargazer", Branch.BANDUNG)], clock());
    const result = engine.decideForAd(
      finding({
        verdict: Verdict.SCALE,
        unit: "Stargazer",
        branch: Branch.BANDUNG,
        budgetIncreaseIDR: config.maxAutoScaleBudgetIDR + 1,
      }),
      9212,
      config,
      confidence,
      memory,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.decisionType).toBe(DecisionType.ESCALATE);
  });
});

describe("VerdictDecisionEngine — S2 new-unit-detected escalation (pinned business-correctness)", () => {
  it("new unit -> portfolio-level ESCALATE with a CREATE_CAMPAIGN suggestion naming model/year/branch", () => {
    const result = engine.decideNewUnitAlert(
      { model: "Brio", year: 2023, branch: Branch.CINERE },
      confidence,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.targetType).toBe("portfolio");
      expect(result.value.actionKind).toBe("CREATE_CAMPAIGN");
      expect(result.value.decisionType).toBe(DecisionType.ESCALATE);
      expect(result.value.reason.toString()).toContain("Brio");
      expect(result.value.reason.toString()).toContain("2023");
      expect(result.value.reason.toString()).toContain(Branch.CINERE);
    }
  });
});
