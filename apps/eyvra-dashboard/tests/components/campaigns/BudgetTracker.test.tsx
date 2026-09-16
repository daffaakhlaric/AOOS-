import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BudgetTracker, paceTone } from "@/components/campaigns/BudgetTracker";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

function campaign(id: string, spend: number, dailyBudget = 0): CampaignSummaryDto {
  return {
    id,
    metaId: id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend,
    dailyBudget: 0,
    // aggregateCampaign (which BudgetTracker's real spend/dailyBudget both come from) sums real
    // per-ad metrics, not this top-level `spend` field — a real ad carrying the real spend is
    // required here, same as every other campaignInsightMath consumer's test fixtures.
    adSets: [
      {
        id: `as-${id}`,
        metaId: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend,
        dailyBudget,
        ads: [
          {
            id: `ad-${id}`,
            metaId: `ad-${id}`,
            stableId: `#C-${id}`,
            name: "Ad",
            status: "ACTIVE",
            funnel: "DM",
            branch: "BINTARO",
            verdict: "KEEP",
            metrics: {
              spend,
              clicks: 0,
              frequency: 0,
              conversations: 0,
              d2: 0,
              d3: 0,
              d5: 0,
              leadForm: 0,
              totalLead: 0,
              rphD3: null,
              rphLead: null,
            },
          },
        ],
      },
    ],
  };
}

// Fixed reference date: 2026-09-10 (day 10 of a 30-day month) — makes the estimate math
// deterministic across test runs (elapsedDays=10, totalDays=30).
const FIXED_NOW = new Date(Date.UTC(2026, 8, 10));

describe("BudgetTracker", () => {
  it("honestly explains that no real per-campaign daily budget exists, never fabricating a progress bar", () => {
    render(<BudgetTracker campaigns={[campaign("a", 1_000_000)]} now={FIXED_NOW} />);
    expect(screen.getByTestId("budget-tracker")).toHaveTextContent("belum tersedia");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows real total spend summed across every campaign", () => {
    render(
      <BudgetTracker
        campaigns={[campaign("a", 1_000_000), campaign("b", 500_000)]}
        now={FIXED_NOW}
      />,
    );
    expect(screen.getByTestId("budget-tracker")).toHaveTextContent("Rp 1.500.000");
  });

  it("renders a real progress bar estimated from dailyBudget x days-in-month when a real dailyBudget exists", () => {
    // dailyBudget 100k x 30 days = 3M estimated monthly budget; spend 900k -> 30%.
    render(<BudgetTracker campaigns={[campaign("a", 900_000, 100_000)]} now={FIXED_NOW} />);
    const bar = screen.getByTestId("budget-bar-a");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "30");
  });

  it("shows an 'over' pace when real spend is well ahead of the dailyBudget-implied pace so far", () => {
    // dailyBudget 100k x 10 elapsed days = 1M expected by now; spend 1.5M -> over pace.
    render(<BudgetTracker campaigns={[campaign("a", 1_500_000, 100_000)]} now={FIXED_NOW} />);
    expect(screen.getByTestId("pace-a")).toHaveAttribute("data-pace", "over");
  });

  it("shows an 'under' pace when real spend is well behind the dailyBudget-implied pace so far", () => {
    // dailyBudget 100k x 10 elapsed days = 1M expected by now; spend 300k -> under pace.
    render(<BudgetTracker campaigns={[campaign("a", 300_000, 100_000)]} now={FIXED_NOW} />);
    expect(screen.getByTestId("pace-a")).toHaveAttribute("data-pace", "under");
  });

  it("never claims the estimate is a real Meta cap — labels it as an estimate", () => {
    render(<BudgetTracker campaigns={[campaign("a", 900_000, 100_000)]} now={FIXED_NOW} />);
    expect(screen.getByTestId("budget-tracker")).toHaveTextContent("ESTIMASI");
  });
});

describe("paceTone", () => {
  it("is on-pace when expectedByNow is 0 (no real daily budget), never fabricating over/under", () => {
    expect(paceTone(1_000_000, 0)).toBe("on-pace");
  });

  it("is over when spend is more than 110% of the expected-by-now pace", () => {
    expect(paceTone(1_200_000, 1_000_000)).toBe("over");
  });

  it("is under when spend is less than 90% of the expected-by-now pace", () => {
    expect(paceTone(800_000, 1_000_000)).toBe("under");
  });

  it("is on-pace within the +/-10% tolerance band", () => {
    expect(paceTone(1_050_000, 1_000_000)).toBe("on-pace");
  });
});
