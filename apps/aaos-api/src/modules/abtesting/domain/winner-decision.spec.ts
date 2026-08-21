import { describe, expect, it } from "vitest";

import { decideWinner, isThresholdMet, type VariantInsight } from "./winner-decision.js";

describe("isThresholdMet", () => {
  it("is met when combined spend reaches the threshold", () => {
    expect(isThresholdMet(100_000, 100_000, 0, 3)).toBe(true);
  });

  it("is met when days running reaches the threshold, even under spend", () => {
    expect(isThresholdMet(1_000, 100_000, 3, 3)).toBe(true);
  });

  it("is not met when neither threshold is reached", () => {
    expect(isThresholdMet(1_000, 100_000, 1, 3)).toBe(false);
  });
});

describe("decideWinner", () => {
  const winner: VariantInsight = { variantId: "A", spend: 52_000, leads: 6, rphLead: 8_667 };
  const loser: VariantInsight = { variantId: "B", spend: 48_000, leads: 4, rphLead: 12_000 };

  it("declares the lower Rp/lead variant winner when margin exceeds the threshold", () => {
    const decision = decideWinner([winner, loser], 20);
    expect(decision?.winnerVariantId).toBe("A");
    expect(decision?.loserVariantIds).toEqual(["B"]);
    expect(decision?.improvementPct).toBe(28);
  });

  it("returns undefined when margin is below the threshold", () => {
    const closeLoser: VariantInsight = { ...loser, rphLead: 9_000 };
    expect(decideWinner([winner, closeLoser], 20)).toBeUndefined();
  });

  it("returns undefined when fewer than 2 variants have a defined rphLead", () => {
    const noLeadsYet: VariantInsight = { variantId: "B", spend: 1_000, leads: 0, rphLead: null };
    expect(decideWinner([winner, noLeadsYet], 20)).toBeUndefined();
  });

  it("excludes variants with null rphLead from ranking but keeps them as losers when a winner is declared", () => {
    const thirdNoLeads: VariantInsight = { variantId: "C", spend: 500, leads: 0, rphLead: null };
    const decision = decideWinner([winner, loser, thirdNoLeads], 20);
    expect(decision?.winnerVariantId).toBe("A");
    expect(decision?.loserVariantIds.sort()).toEqual(["B", "C"]);
  });

  it("returns undefined for a single variant", () => {
    expect(decideWinner([winner], 20)).toBeUndefined();
  });
});
