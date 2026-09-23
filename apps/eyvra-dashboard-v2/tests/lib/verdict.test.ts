import { describe, expect, it } from "vitest";

import {
  aggregateVerdict,
  computeCampaignVerdicts,
  computeCpl,
  stripAdNameSuffix,
} from "@/lib/verdict";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

describe("aggregateVerdict", () => {
  it("picks the highest-priority real verdict present", () => {
    expect(aggregateVerdict(["KEEP", "SCALE", "REVIEW"])).toBe("SCALE");
    expect(aggregateVerdict(["FIX", "PAUSE"])).toBe("FIX");
    expect(aggregateVerdict([])).toBe("REVIEW");
  });
});

describe("computeCpl", () => {
  it("is null (never a fabricated 0) when there are no leads", () => {
    expect(computeCpl(100, 0)).toBeNull();
    expect(computeCpl(100, 5)).toBe(20);
  });
});

describe("stripAdNameSuffix", () => {
  it("strips a trailing UUID-shaped suffix", () => {
    expect(stripAdNameSuffix("Campaign A - Ad 019f94fd-8841-7dd0-abf9-5d65888159bd")).toBe(
      "Campaign A",
    );
    expect(stripAdNameSuffix("Plain Campaign Name")).toBe("Plain Campaign Name");
  });
});

describe("computeCampaignVerdicts", () => {
  it("aggregates a real campaign's verdict/spend/cpl from its ad tree", () => {
    const campaign: CampaignSummaryDto = {
      id: "c1",
      metaId: "m1",
      stableId: "s1",
      name: "Test",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 999,
      dailyBudget: 100,
      adSets: [
        {
          id: "as1",
          metaId: "am1",
          stableId: "ass1",
          name: "AS",
          status: "ACTIVE",
          spend: 100,
          dailyBudget: 100,
          ads: [
            {
              id: "ad1",
              metaId: "adm1",
              stableId: "ads1",
              name: "Ad",
              status: "ACTIVE",
              verdict: "PAUSE",
              metrics: { spend: 200_000, clicks: 10, frequency: 1, totalLead: 4 },
            },
          ],
        },
      ],
    };
    const [row] = computeCampaignVerdicts([campaign]);
    expect(row?.verdict).toBe("PAUSE");
    expect(row?.spend).toBe(200_000);
    expect(row?.cpl).toBe(50_000);
  });
});
