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
    metaId: "ad-1",
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
    metaId: id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status,
    spend: adOverrides.spend ?? 1_000_000,
    dailyBudget: 0,
    adSets: [
      {
        id: `as-${id}`,
        metaId: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend: adOverrides.spend ?? 1_000_000,
        dailyBudget: 500_000,
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

  // AdAdvisor-style table (user-requested: "data table campaign nya lengkap gini kaya di adavisor")
  // — real, already-pulled Meta fields (`AdSetSummaryDto.dailyBudget`) this app's proxy never
  // forwarded until now.
  it("shows the real Daily Budget summed across the campaign's real ad sets, never a fabricated cap", () => {
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
    // campaignWith's fixture sets dailyBudget: 500_000 on its one real ad set.
    expect(screen.getByTestId("daily-budget-x")).toHaveTextContent("Rp 500.000");
  });

  it("shows an honest '—' for Daily Budget when the campaign genuinely has no real ad sets", () => {
    const campaigns: CampaignSummaryDto[] = [{ ...campaignWith("x", "ACTIVE", {}), adSets: [] }];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("daily-budget-x")).toHaveTextContent("—");
  });

  // Real ABO-vs-CBO fallback (user-reported gap: "saya cek daily budget masih... kosong") — a CBO
  // campaign's real budget lives on the campaign itself, never on any of its real ad sets.
  it("falls back to the real campaign-level Daily Budget (CBO) when every real ad set's is honestly 0", () => {
    const campaign = campaignWith("x", "ACTIVE", {});
    const cboCampaign: CampaignSummaryDto = {
      ...campaign,
      dailyBudget: 750_000,
      adSets: campaign.adSets.map((adSet) => ({ ...adSet, dailyBudget: 0 })),
    };
    render(
      <UnifiedCampaignTable
        campaigns={[cboCampaign]}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("daily-budget-x")).toHaveTextContent("Rp 750.000");
  });

  it("shows real Impressions/Reach/CTR/CPC/CPM derived from the campaign's own already-loaded ad metrics", () => {
    const campaigns = [
      campaignWith("x", "ACTIVE", {
        spend: 100_000,
        clicks: 50,
        impressions: 1_000,
        reach: 800,
        totalLead: 10,
      }),
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
    expect(screen.getByTestId("results-x")).toHaveTextContent("10");
    expect(screen.getByTestId("impressions-x")).toHaveTextContent("1.000");
    expect(screen.getByTestId("reach-x")).toHaveTextContent("800");
    expect(screen.getByTestId("ctr-x")).toHaveTextContent("5"); // 50/1_000 = 5%
    expect(screen.getByTestId("cpc-x")).toHaveTextContent("Rp 2.000"); // 100_000/50
    expect(screen.getByTestId("cpm-x")).toHaveTextContent("Rp 100.000"); // 100_000/1_000*1_000
  });

  it("shows an honest '—' (never a fabricated 0) for Impressions/Reach/CTR/CPM when no ad carries a real value yet", () => {
    const campaigns = [campaignWith("x", "ACTIVE", { spend: 0, clicks: 0, totalLead: 0 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("impressions-x")).toHaveTextContent("—");
    expect(screen.getByTestId("reach-x")).toHaveTextContent("—");
    expect(screen.getByTestId("ctr-x")).toHaveTextContent("—");
    expect(screen.getByTestId("cpc-x")).toHaveTextContent("—");
    expect(screen.getByTestId("cpm-x")).toHaveTextContent("—");
  });

  // Deliberate scope boundary (user-confirmed): Revenue/ROAS/AOV and the e-commerce funnel
  // (View Content/Add to Cart/Init. Checkout/Purchases) are never rendered — this tenant's real
  // Meta pull carries no revenue/purchase/pixel data (WhatsApp lead-gen, not e-commerce).
  it("never renders a Revenue/ROAS/AOV column or e-commerce funnel columns — no real data source exists for them", () => {
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
    for (const label of ["Revenue", "ROAS", "AOV", "Add to Cart", "Purchases"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
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

  it("AAOS Samantha Professional Optimizer, Part D: shows the real Learning Phase badge when a campaign's adset is still LEARNING", () => {
    const campaign = campaignWith("lp", "ACTIVE", { spend: 100, totalLead: 1 });
    const learningCampaign: CampaignSummaryDto = {
      ...campaign,
      adSets: campaign.adSets.map((adSet) => ({ ...adSet, learningStatus: "LEARNING" })),
    };
    render(
      <UnifiedCampaignTable
        campaigns={[learningCampaign]}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.getByTestId("learning-phase-badge")).toBeInTheDocument();
  });

  it("does NOT show the Learning Phase badge for a campaign whose adsets have no learningStatus (the honest default — real Meta didn't report one, or it's SUCCESS)", () => {
    const campaigns = [campaignWith("stable", "ACTIVE", { spend: 100, totalLead: 1 })];
    render(
      <UnifiedCampaignTable
        campaigns={campaigns}
        benchmarkCplIDR={null}
        selectedCampaignId={undefined}
        onSelect={vi.fn()}
        onPause={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("learning-phase-badge")).not.toBeInTheDocument();
  });
});
