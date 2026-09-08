import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UnifiedCampaignTable } from "@/components/campaigns/UnifiedCampaignTable";
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

function campaignWith(
  id: string,
  status: string,
  adOverrides: Partial<AdMetricsDto>,
  verdict = "SCALE",
): CampaignSummaryDto {
  return {
    id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status,
    spend: adOverrides.spend ?? 1_000_000,
    adSets: [
      {
        id: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend: adOverrides.spend ?? 1_000_000,
        ads: [ad({ id: `ad-${id}`, verdict, metrics: metrics(adOverrides) })],
      },
    ],
  };
}

describe("UnifiedCampaignTable", () => {
  it("colors the CPL pill green when strictly below 85% of the benchmark", () => {
    const campaigns = [campaignWith("good", "ACTIVE", { spend: 800_000, totalLead: 10 })]; // cpl=80k, benchmark 100k -> 80%
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={100_000}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cpl-pill")).toHaveAttribute("data-tone", "good");
  });

  it("colors the CPL pill red when strictly above 115% of the benchmark", () => {
    const campaigns = [campaignWith("bad", "ACTIVE", { spend: 1_200_000, totalLead: 10 })]; // cpl=120k, benchmark 100k -> 120%
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={100_000}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cpl-pill")).toHaveAttribute("data-tone", "bad");
  });

  it("shows the neutral 'unknown' tone when no real benchmark is available", () => {
    const campaigns = [campaignWith("noBenchmark", "ACTIVE", { spend: 800_000, totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cpl-pill")).toHaveAttribute("data-tone", "unknown");
  });

  it("shows a real frequency warning badge above the 3.5 threshold", () => {
    const campaigns = [campaignWith("hot", "ACTIVE", { frequency: 4.2, totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("frequency-warning")).toBeInTheDocument();
  });

  it("does not show a frequency warning badge at or below 3.5", () => {
    const campaigns = [campaignWith("cool", "ACTIVE", { frequency: 3.5, totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("frequency-warning")).not.toBeInTheDocument();
  });

  it("shows an honest '—' (never a fabricated cap) in the Budget column — no real per-campaign budget field exists", () => {
    const campaigns = [campaignWith("x", "ACTIVE", { totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    const budgetCells = screen.getAllByTitle(
      "Tidak ada field budget per-campaign yang real di data Meta Ads saat ini.",
    );
    expect(budgetCells).toHaveLength(1);
  });

  it("calls onSelect with the campaign id when a row is clicked", async () => {
    const onSelect = vi.fn();
    const campaigns = [campaignWith("x", "ACTIVE", { totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={onSelect}
        onPause={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByTestId("campaign-row-x"));
    expect(onSelect).toHaveBeenCalledWith("x");
  });

  it("StatusToggle: clicking an ACTIVE campaign's toggle calls onPause with its id, real PAUSE-only mechanism", async () => {
    const onPause = vi.fn();
    const campaigns = [campaignWith("x", "ACTIVE", { totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={onPause}
      />,
    );
    await userEvent.click(screen.getByTestId("status-toggle"));
    expect(onPause).toHaveBeenCalledWith("x");
  });

  it("StatusToggle: a PAUSED campaign's toggle is disabled — no real 'resume' verdict exists", () => {
    const campaigns = [campaignWith("x", "PAUSED", { totalLead: 10 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("status-toggle")).toBeDisabled();
  });

  it("shows the real Samantha verdict badge from aggregateVerdict", () => {
    const campaigns = [campaignWith("x", "ACTIVE", { totalLead: 10 }, "SCALE")];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("verdict-badge")).toHaveAttribute("data-verdict", "SCALE");
  });

  it("renders a real total row summing spend/leads across all shown campaigns", () => {
    const campaigns = [
      campaignWith("a", "ACTIVE", { spend: 100, totalLead: 1 }),
      campaignWith("b", "ACTIVE", { spend: 200, totalLead: 2 }),
    ];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("campaign-table-total-row")).toHaveTextContent("Total (2 campaign)");
  });

  it("shows an honest empty state when there are no campaigns", () => {
    render(
      <UnifiedCampaignTable
        campaigns={[]}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});
