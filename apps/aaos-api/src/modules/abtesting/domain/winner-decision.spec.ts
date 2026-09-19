import { describe, expect, it } from "vitest";

import {
  assessVariantSufficiency,
  decideWinner,
  isExperimentReadyToDecide,
  isThresholdMet,
  type VariantInsight,
} from "./winner-decision.js";

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
  const winner: VariantInsight = {
    variantId: "A",
    spend: 52_000,
    impressions: 12_400,
    clicks: 260,
    leads: 6,
    rphLead: 8_667,
  };
  const loser: VariantInsight = {
    variantId: "B",
    spend: 48_000,
    impressions: 11_200,
    clicks: 200,
    leads: 4,
    rphLead: 12_000,
  };

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
    const noLeadsYet: VariantInsight = {
      variantId: "B",
      spend: 1_000,
      impressions: 500,
      clicks: 10,
      leads: 0,
      rphLead: null,
    };
    expect(decideWinner([winner, noLeadsYet], 20)).toBeUndefined();
  });

  it("excludes variants with null rphLead from ranking but keeps them as losers when a winner is declared", () => {
    const thirdNoLeads: VariantInsight = {
      variantId: "C",
      spend: 500,
      impressions: 300,
      clicks: 5,
      leads: 0,
      rphLead: null,
    };
    const decision = decideWinner([winner, loser, thirdNoLeads], 20);
    expect(decision?.winnerVariantId).toBe("A");
    expect(decision?.loserVariantIds.sort()).toEqual(["B", "C"]);
  });

  it("returns undefined for a single variant", () => {
    expect(decideWinner([winner], 20)).toBeUndefined();
  });
});

describe("assessVariantSufficiency", () => {
  const winner: VariantInsight = {
    variantId: "A",
    spend: 52_000,
    impressions: 12_400,
    clicks: 260,
    leads: 6,
    rphLead: 8_667,
  };
  const loser: VariantInsight = {
    variantId: "B",
    spend: 48_000,
    impressions: 11_200,
    clicks: 200,
    leads: 4,
    rphLead: 12_000,
  };

  it("assigns a real per-variant level using the SAME thresholds data-sufficiency.ts uses elsewhere", () => {
    const [levelA, levelB] = assessVariantSufficiency([winner, loser], 4);
    expect(levelA?.variantId).toBe("A");
    expect(levelA?.level).toBe("LOW"); // impressions/days clear INSUFFICIENT, leads (6) below LOW_LEADS_THRESHOLD (10)
    expect(levelB?.level).toBe("LOW");
  });

  it("flags a variant as INSUFFICIENT when its own impressions are too thin, even if days are fine", () => {
    const thin: VariantInsight = {
      variantId: "C",
      spend: 1_000,
      impressions: 200,
      clicks: 5,
      leads: 1,
      rphLead: 1_000,
    };
    const [level] = assessVariantSufficiency([thin], 4);
    expect(level?.level).toBe("INSUFFICIENT");
    expect(level?.reasons.length).toBeGreaterThan(0);
  });

  it("flags a variant as INSUFFICIENT when too few real days have elapsed, even with high impressions", () => {
    const freshButBig: VariantInsight = {
      variantId: "D",
      spend: 90_000,
      impressions: 15_000,
      clicks: 300,
      leads: 8,
      rphLead: 11_250,
    };
    const [level] = assessVariantSufficiency([freshButBig], 1);
    expect(level?.level).toBe("INSUFFICIENT");
  });
});

describe("isExperimentReadyToDecide", () => {
  it("is true once every variant clears the INSUFFICIENT floor", () => {
    const sufficiencies = assessVariantSufficiency(
      [
        {
          variantId: "A",
          spend: 52_000,
          impressions: 12_400,
          clicks: 260,
          leads: 6,
          rphLead: 8_667,
        },
        {
          variantId: "B",
          spend: 48_000,
          impressions: 11_200,
          clicks: 200,
          leads: 4,
          rphLead: 12_000,
        },
      ],
      4,
    );
    expect(isExperimentReadyToDecide(sufficiencies)).toBe(true);
  });

  it("is false when any single variant is still INSUFFICIENT — the real 'no premature winner' gate", () => {
    const sufficiencies = assessVariantSufficiency(
      [
        { variantId: "A", spend: 99_000, impressions: 500, clicks: 8, leads: 1, rphLead: 99_000 },
        { variantId: "B", spend: 1_000, impressions: 20_000, clicks: 300, leads: 50, rphLead: 20 },
      ],
      4,
    );
    expect(isExperimentReadyToDecide(sufficiencies)).toBe(false);
  });

  it("is false for a single variant (nothing to compare against)", () => {
    const sufficiencies = assessVariantSufficiency(
      [
        {
          variantId: "A",
          spend: 52_000,
          impressions: 12_400,
          clicks: 260,
          leads: 6,
          rphLead: 8_667,
        },
      ],
      4,
    );
    expect(isExperimentReadyToDecide(sufficiencies)).toBe(false);
  });

  it("is false for an empty list", () => {
    expect(isExperimentReadyToDecide([])).toBe(false);
  });
});
