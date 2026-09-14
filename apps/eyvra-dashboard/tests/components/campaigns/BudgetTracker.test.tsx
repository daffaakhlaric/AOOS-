import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BudgetTracker } from "@/components/campaigns/BudgetTracker";
import type { CampaignSummaryDto } from "@/types/dashboard.types";

function campaign(id: string, spend: number): CampaignSummaryDto {
  return {
    id,
    metaId: id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend,
    adSets: [],
  };
}

describe("BudgetTracker", () => {
  it("honestly explains that no real per-campaign budget-cap field exists, never fabricating a progress bar", () => {
    render(<BudgetTracker campaigns={[campaign("a", 1_000_000)]} />);
    expect(screen.getByTestId("budget-tracker")).toHaveTextContent("belum tersedia");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows real total spend summed across every campaign", () => {
    render(<BudgetTracker campaigns={[campaign("a", 1_000_000), campaign("b", 500_000)]} />);
    expect(screen.getByTestId("budget-tracker")).toHaveTextContent("Rp 1.500.000");
  });
});
