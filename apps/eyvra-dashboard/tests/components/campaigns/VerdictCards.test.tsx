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

  it("SPRINT 4 FIX: shows the campaign's real non-zero spend/CPL, never a fabricated Rp 0 — same aggregateCampaign/computeCpl math UnifiedCampaignTable uses on the identical campaign object", () => {
    const campaign = campaignWith("fix", "FIX");
    render(<VerdictCards campaigns={[campaign]} onApply={vi.fn()} />);
    // Real fixture: 1 ad, spend 1_000_000, totalLead 10 => CPL = 100_000.
    const meta = screen.getByText(/spend/);
    expect(meta.textContent).not.toMatch(/Rp\s*0\s*spend/i);
    expect(meta.textContent).not.toContain("—");
    expect(meta.textContent).toMatch(/Rp\s*1\.000\.000/);
  });

  it("SPRINT 4 FIX: strips a UUID-looking name suffix the same way UnifiedCampaignTable already does (stripAdNameSuffix), instead of rendering the raw name", () => {
    const campaign = campaignWith("suffixed", "PAUSE");
    const withSuffix: typeof campaign = {
      ...campaign,
      name: `${campaign.name} - Ad 019f94fd-8841-7dd0-abf9-5d65888159bd`,
    };
    render(<VerdictCards campaigns={[withSuffix]} onApply={vi.fn()} />);
    expect(screen.getByText(campaign.name)).toBeInTheDocument();
    expect(screen.queryByText(withSuffix.name)).not.toBeInTheDocument();
  });

  it("SPRINT 4 FIX: Terapkan gives real pending feedback (disabled + 'Menerapkan…') while the page-wide pull() it triggered is still loading, instead of sitting inert/static", async () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <VerdictCards
        campaigns={[campaignWith("pause", "PAUSE")]}
        onApply={onApply}
        loading={false}
      />,
    );
    const applyButton = screen.getByTestId("verdict-apply-pause");
    expect(applyButton).not.toBeDisabled();
    expect(applyButton).toHaveTextContent("Terapkan");

    await userEvent.click(applyButton);
    expect(onApply).toHaveBeenCalledWith("pause", "PAUSE");

    // Parent's `loading` (the SAME `useCampaignsSnapshot().loading` the pull() this click
    // triggered flips on) becomes true while the refresh is in flight.
    rerender(
      <VerdictCards
        campaigns={[campaignWith("pause", "PAUSE")]}
        onApply={onApply}
        loading={true}
      />,
    );
    expect(screen.getByTestId("verdict-apply-pause")).toBeDisabled();
    expect(screen.getByTestId("verdict-apply-pause")).toHaveTextContent("Menerapkan…");

    // Once the pull resolves, loading flips back to false — the card returns to its real, honest
    // interactive state (never stuck showing "Menerapkan…" forever).
    rerender(
      <VerdictCards
        campaigns={[campaignWith("pause", "PAUSE")]}
        onApply={onApply}
        loading={false}
      />,
    );
    expect(screen.getByTestId("verdict-apply-pause")).not.toBeDisabled();
    expect(screen.getByTestId("verdict-apply-pause")).toHaveTextContent("Terapkan");
  });
});
