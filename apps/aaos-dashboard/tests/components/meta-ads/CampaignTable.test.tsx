import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CampaignTable } from "@/components/meta-ads/CampaignTable";
import type { CampaignAdDto } from "@/types/dashboard.types";

function buildAd(overrides: Partial<CampaignAdDto> = {}): CampaignAdDto {
  return {
    id: "A001",
    stableId: "#A001",
    name: "#A001 Meta-DM-Leads-Mobix",
    campaignName: "Meta-DM-Leads-Mobix",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "REVIEW",
    metrics: {
      spend: 6_000_000,
      clicks: 1200,
      frequency: 2.1,
      conversations: 790,
      d2: 400,
      d3: 307,
      d5: 100,
      leadForm: 20,
      totalLead: 320,
      rphD3: 19_541,
    },
    ...overrides,
  };
}

describe("CampaignTable", () => {
  it("renders #A001 with correct metrics", () => {
    render(<CampaignTable ads={[buildAd()]} />);
    expect(screen.getByText("#A001 Meta-DM-Leads-Mobix")).toBeInTheDocument();
    expect(screen.getByText(/790 chat/)).toBeInTheDocument();
    expect(screen.getByText(/307 D3/)).toBeInTheDocument();
  });

  it("VerdictBadge shows the correct color per verdict", () => {
    render(<CampaignTable ads={[buildAd({ verdict: "PAUSE" })]} />);
    expect(screen.getByText("PAUSE")).toHaveClass("text-red-700");
  });

  it("Execute button is visible and calls onExecute", async () => {
    const onExecute = vi.fn();
    render(<CampaignTable ads={[buildAd()]} onExecute={onExecute} />);
    const button = screen.getByRole("button", { name: /Execute/ });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onExecute).toHaveBeenCalledWith(expect.objectContaining({ id: "A001" }));
  });

  it("shows an empty state when there are no ads", () => {
    render(<CampaignTable ads={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
