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

const CAMPAIGN: CampaignSummaryDto = {
  id: "camp-1",
  metaId: "camp-1",
  stableId: "#A001",
  name: "Xpander Bintaro",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 1_000_000,
  adSets: [
    {
      id: "as1",
      metaId: "as1",
      stableId: "#B001",
      name: "AdSet 1",
      status: "ACTIVE",
      spend: 1_000_000,
      dailyBudget: 500_000,
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

  // SAMANTHA ADVANCED SPRINT 2 — the campaign-insight request body must carry the real per-ad
  // breakdown and learning-ad-set list already loaded client-side, composed from `campaign.adSets`
  // (never a second Meta pull).
  it("composes the real per-ad breakdown and learning-ad-set stableIds into the /api/campaign-insight request", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ available: true, narrative: "OK", actions: [] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const learningCampaign: CampaignSummaryDto = {
      ...CAMPAIGN,
      adSets: [{ ...CAMPAIGN.adSets[0]!, learningStatus: "LEARNING" }],
    };

    render(
      <CampaignInsightPanel
        campaign={learningCampaign}
        benchmarkCplIDR={150_000}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([calledUrl]) => calledUrl === "/api/campaign-insight"),
      ).toBe(true),
    );
    const insightCall = fetchMock.mock.calls.find(
      ([calledUrl]) => calledUrl === "/api/campaign-insight",
    )!;
    const body = JSON.parse(insightCall[1]!.body as string) as {
      ads: Array<{ stableId: string; name: string; rphChatIDR: number | null }>;
      learningAdSetStableIds: string[];
    };
    expect(body.ads).toHaveLength(1);
    expect(body.ads[0]).toMatchObject({ stableId: "#C001", name: "Ad 1", rphChatIDR: 25_000 });
    expect(body.learningAdSetStableIds).toEqual(["#B001"]);
  });

  // A healthy campaign with no learning ad sets must honestly send an EMPTY array, never omit the
  // field or fabricate a non-empty one.
  it("sends an empty learningAdSetStableIds array when no ad set is in Learning Phase", async () => {
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

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([calledUrl]) => calledUrl === "/api/campaign-insight"),
      ).toBe(true),
    );
    const insightCall = fetchMock.mock.calls.find(
      ([calledUrl]) => calledUrl === "/api/campaign-insight",
    )!;
    const body = JSON.parse(insightCall[1]!.body as string) as { learningAdSetStableIds: string[] };
    expect(body.learningAdSetStableIds).toEqual([]);
  });

  // Real bug fix (live-confirmed report, same finding as VerdictCards.tsx's own fix): a delayed/
  // partial ad-level Meta Insights pull can leave every ad's spend at 0 (aggregate.spend === 0)
  // while campaign.spend (the real campaign-level Insights row) is non-zero. Before this fix, both
  // the KPI grid and the /api/campaign-insight request body silently sent the misleading Rp 0 —
  // starving Samantha's narrative of the real spend context and making her analysis look generic.
  it("real bug fix: falls back to the real campaign.spend (with a warning badge) when the ad-level rollup is Rp 0, and sends that real spend to /api/campaign-insight instead of a misleading 0", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ available: true, narrative: "OK", actions: [] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const delayedAdLevelPull: CampaignSummaryDto = {
      ...CAMPAIGN,
      spend: 2_500_000,
      adSets: [
        {
          ...CAMPAIGN.adSets[0]!,
          ads: [ad({ metrics: metrics({ spend: 0, totalLead: 0 }) })],
        },
      ],
    };

    render(
      <CampaignInsightPanel
        campaign={delayedAdLevelPull}
        benchmarkCplIDR={150_000}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("insight-kpi-spend")).toHaveTextContent("2.500.000");
    expect(screen.getByTestId("insight-kpi-cpl")).toHaveTextContent("—");
    expect(screen.getByTestId("metric-card-warning")).toHaveTextContent(
      "Breakdown per-iklan belum tersedia",
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([calledUrl]) => calledUrl === "/api/campaign-insight"),
      ).toBe(true),
    );
    const insightCall = fetchMock.mock.calls.find(
      ([calledUrl]) => calledUrl === "/api/campaign-insight",
    )!;
    const body = JSON.parse(insightCall[1]!.body as string) as { spend: number };
    expect(body.spend).toBe(2_500_000);
  });

  it("does NOT show the spend-fallback warning for a genuinely zero-spend campaign", () => {
    mockFetchOnce({ available: true, narrative: "x", actions: [] });
    const genuineZero: CampaignSummaryDto = {
      ...CAMPAIGN,
      spend: 0,
      adSets: [
        {
          ...CAMPAIGN.adSets[0]!,
          ads: [ad({ metrics: metrics({ spend: 0, totalLead: 0 }) })],
        },
      ],
    };
    render(
      <CampaignInsightPanel campaign={genuineZero} benchmarkCplIDR={150_000} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("insight-kpi-spend")).toHaveTextContent("0");
    expect(screen.queryByTestId("metric-card-warning")).not.toBeInTheDocument();
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
