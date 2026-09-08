import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VerdictCards } from "@/components/campaigns/VerdictCards";
import type { AdMetricsDto, AdSummaryDto, CampaignSummaryDto } from "@/types/dashboard.types";

function metrics(overrides: Partial<AdMetricsDto> = {}): AdMetricsDto {
  return {
    spend: 1_000_000,
    clicks: 100,
    frequency: 1.0,
    conversations: 40,
    d2: 20,
    d3: 10,
    d5: 5,
    leadForm: 2,
    totalLead: 10,
    rphD3: null,
    rphLead: null,
    ...overrides,
  };
}

function ad(overrides: Partial<AdSummaryDto> = {}): AdSummaryDto {
  return {
    id: "ad-1",
    stableId: "#C001",
    name: "Ad 1",
    status: "ACTIVE",
    funnel: "DM",
    branch: "BINTARO",
    verdict: "SCALE",
    metrics: metrics(),
    ...overrides,
  };
}

function campaignWith(id: string, verdict: string): CampaignSummaryDto {
  return {
    id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 1_000_000,
    adSets: [
      {
        id: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend: 1_000_000,
        ads: [ad({ id: `ad-${id}`, verdict })],
      },
    ],
  };
}

describe("VerdictCards", () => {
  it("shows only actionable verdicts (SCALE/PAUSE/FIX/REFRESH), never KEEP/REVIEW", () => {
    const campaigns = [
      campaignWith("scale", "SCALE"),
      campaignWith("keep", "KEEP"),
      campaignWith("review", "REVIEW"),
    ];
    render(<VerdictCards campaigns={campaigns} onApply={vi.fn()} />);
    expect(screen.getByTestId("verdict-card-scale")).toBeInTheDocument();
    expect(screen.queryByTestId("verdict-card-keep")).not.toBeInTheDocument();
    expect(screen.queryByTestId("verdict-card-review")).not.toBeInTheDocument();
  });

  it("an honest empty state when nothing is actionable", () => {
    render(<VerdictCards campaigns={[campaignWith("keep", "KEEP")]} onApply={vi.fn()} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("Terapkan calls onApply with the real campaign id + verdict — the SAME /api/verdicts mechanism CampaignTree's Execute button uses", async () => {
    const onApply = vi.fn();
    render(<VerdictCards campaigns={[campaignWith("pause", "PAUSE")]} onApply={onApply} />);
    await userEvent.click(screen.getByTestId("verdict-apply-pause"));
    expect(onApply).toHaveBeenCalledWith("pause", "PAUSE");
  });

  it("Lewati is a real, honest LOCAL-ONLY dismiss (hides the card, calls no backend)", async () => {
    render(<VerdictCards campaigns={[campaignWith("pause", "PAUSE")]} onApply={vi.fn()} />);
    expect(screen.getByTestId("verdict-card-pause")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("verdict-skip-pause"));
    expect(screen.queryByTestId("verdict-card-pause")).not.toBeInTheDocument();
  });
});
