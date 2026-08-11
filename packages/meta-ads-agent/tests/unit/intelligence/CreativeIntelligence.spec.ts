import { Branch, Verdict } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { CreativeIntelligence } from "../../../src/intelligence/CreativeIntelligence.js";
import type { PerAdFinding } from "../../../src/types/AgentTypes.js";

function finding(overrides: Partial<PerAdFinding>): PerAdFinding {
  return {
    adId: "ad",
    targetId: "ad",
    targetType: "ad",
    verdict: Verdict.REFRESH,
    branch: Branch.BINTARO,
    unit: "Xpander",
    spendIDR: 100_000,
    conversations: 10,
    rphChatIDR: 10_000,
    rphD3IDR: 10_000,
    ...overrides,
  };
}

describe("CreativeIntelligence", () => {
  it("identifyWorstPerformer returns undefined when there are no REFRESH candidates", () => {
    expect(
      CreativeIntelligence.identifyWorstPerformer([finding({ verdict: Verdict.KEEP })]),
    ).toBeUndefined();
  });

  it("identifyWorstPerformer picks the highest rphD3 among REFRESH-verdict ads", () => {
    const cheap = finding({ adId: "cheap", rphD3IDR: 8_000 });
    const expensive = finding({ adId: "expensive", rphD3IDR: 20_000 });
    const worst = CreativeIntelligence.identifyWorstPerformer([cheap, expensive]);
    expect(worst?.adId).toBe("expensive");
  });

  it("identifyWorstPerformer treats a null (undefined) rphD3 as worse than any defined rate", () => {
    const defined = finding({ adId: "defined", rphD3IDR: 50_000 });
    const undefinedRate = finding({ adId: "undefined-rate", rphD3IDR: null });
    const worst = CreativeIntelligence.identifyWorstPerformer([defined, undefinedRate]);
    expect(worst?.adId).toBe("undefined-rate");
  });

  it("rankRefreshCandidates orders worst-first and excludes non-REFRESH findings", () => {
    const a = finding({ adId: "a", rphD3IDR: 5_000 });
    const b = finding({ adId: "b", rphD3IDR: 30_000 });
    const c = finding({ adId: "c", verdict: Verdict.KEEP });
    const ranked = CreativeIntelligence.rankRefreshCandidates([a, b, c]);
    expect(ranked.map((f) => f.adId)).toEqual(["b", "a"]);
  });

  it("identifyWorstPerformer treats two null-rphD3 REFRESH ads as equally worst", () => {
    const nullA = finding({ adId: "null-a", rphD3IDR: null });
    const nullB = finding({ adId: "null-b", rphD3IDR: null });
    const worst = CreativeIntelligence.identifyWorstPerformer([nullA, nullB]);
    expect(worst?.adId).toBe("null-a");
  });

  it("rankRefreshCandidates treats two null-rphD3 REFRESH ads as equally worst", () => {
    const nullA = finding({ adId: "null-a", rphD3IDR: null });
    const nullB = finding({ adId: "null-b", rphD3IDR: null });
    const ranked = CreativeIntelligence.rankRefreshCandidates([nullA, nullB]);
    expect(ranked.map((f) => f.adId)).toEqual(["null-a", "null-b"]);
  });
});
