import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignInsightPanel } from "@/components/campaigns/CampaignInsightPanel";
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

const CAMPAIGN: CampaignSummaryDto = {
  id: "camp-1",
  stableId: "#A001",
  name: "Xpander Bintaro",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 1_000_000,
  adSets: [
    {
      id: "as1",
      stableId: "#B001",
      name: "AdSet 1",
      status: "ACTIVE",
      spend: 1_000_000,
      ads: [ad()],
    },
  ],
};

function mockFetchOnce(body: unknown, status = 200): void {
  global.fetch = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
}

describe("CampaignInsightPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the real, already-aggregated campaign context to /api/campaign-insight", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ available: true, narrative: "OK", actions: [] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/campaign-insight");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body["campaignId"]).toBe("camp-1");
    expect(body["spend"]).toBe(1_000_000);
    expect(body["totalLead"]).toBe(10);
    expect(body["benchmarkCplIDR"]).toBe(150_000);
  });

  it("renders the real narrative + grouped, prioritized action list when available", async () => {
    mockFetchOnce({
      available: true,
      narrative: "Campaign ini SCALE-worthy.",
      actions: [
        { priority: "MINGGU_INI", text: "Pantau frequency." },
        { priority: "SEGERA", text: "Naikkan budget." },
      ],
    });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-narrative")).toHaveTextContent(
        "Campaign ini SCALE-worthy.",
      ),
    );
    const items = screen.getAllByRole("listitem");
    // SEGERA sorts before MINGGU_INI regardless of the response's own order.
    expect(items[0]).toHaveTextContent("Naikkan budget.");
    expect(items[1]).toHaveTextContent("Pantau frequency.");
  });

  it("honest degrade: renders the real 'belum tersedia' message, never a fabricated narrative, when available:false", async () => {
    mockFetchOnce({
      available: false,
      reason: "NO_API_KEY",
      message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
    });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId("insight-unavailable")).toBeInTheDocument());
    expect(screen.getByTestId("insight-unavailable")).toHaveTextContent("Analisa belum tersedia");
  });

  it("shows the real 6-KPI grid computed from already-loaded data, not the LLM response", () => {
    mockFetchOnce({ available: true, narrative: "x", actions: [] });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    const grid = screen.getByTestId("insight-kpi-grid");
    expect(grid).toHaveTextContent("Spend");
    expect(grid).toHaveTextContent("CPL");
    expect(grid).toHaveTextContent("CTR");
    expect(grid).toHaveTextContent("Impressions");
    expect(grid).toHaveTextContent("Frequency");
    expect(grid).toHaveTextContent("Results");
  });

  it("shows the real campaign objective prominently (user feedback: 'objective settingannya juga keliatan')", () => {
    mockFetchOnce({ available: true, narrative: "x", actions: [] });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("insight-objective")).toHaveTextContent("OUTCOME_LEADS");
  });

  it("renders the real ad-set/ad drill-down (CampaignAdDrillDown) for the selected campaign", () => {
    mockFetchOnce({ available: true, narrative: "x", actions: [] });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("insight-drilldown-block")).toBeInTheDocument();
    expect(screen.getByTestId("ad-drilldown")).toBeInTheDocument();
    expect(screen.getByTestId("open-adset-as1")).toBeInTheDocument();
  });

  it("links to the real A/B Testing escape hatch (?view=ab-testing), never silently dropped", () => {
    mockFetchOnce({ available: true, narrative: "x", actions: [] });
    render(
      <CampaignInsightPanel campaign={CAMPAIGN} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Kelola A/B Test ↗")).toHaveAttribute(
      "href",
      "/campaigns?view=ab-testing",
    );
  });
});
