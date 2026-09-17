import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CampaignInsightPanel } from "@/components/campaigns/CampaignInsightPanel";
import type {
  AdMetricsDto,
  AdSummaryDto,
  CampaignInsightResponseDto,
  CampaignSummaryDto,
} from "@/types/dashboard.types";

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
  dailyBudget: 0,
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

/** A real, fully-valid SAMANTHA ADVANCED INSIGHT ENGINE payload — every test overrides only what it needs. */
function validInsight(
  overrides: Partial<Extract<CampaignInsightResponseDto, { available: true }>> = {},
): CampaignInsightResponseDto {
  return {
    available: true,
    triage: { level: "SEHAT", why: "CPL di bawah benchmark, frequency aman." },
    verdict: "SCALE",
    confidence: 80,
    verdictOneLiner: "Campaign ini SCALE-worthy, CPL di bawah benchmark.",
    rootCause: { primary: "CPL efisien.", primaryEvidence: "CPL Rp100rb di bawah benchmark." },
    metricBreakdown: [
      {
        metric: "CPL Rp100rb",
        status: "good",
        interpretation: "di bawah benchmark",
        vsContext: "vs benchmark akun",
        trend: "stabil",
        trendDetail: "stabil",
      },
      {
        metric: "Frequency 1.0x",
        status: "good",
        interpretation: "masih aman",
        vsContext: "vs threshold",
        trend: "stabil",
        trendDetail: "stabil",
      },
      {
        metric: "CTR",
        status: "neutral",
        interpretation: "responsif",
        vsContext: "vs rata-rata",
        trend: "stabil",
        trendDetail: "stabil",
      },
    ],
    whatHappened: "Campaign berjalan stabil.",
    playbook: {
      immediate: {
        action: "Naikkan budget.",
        how: "Naikkan daily budget.",
        why: "CPL efisien.",
        expectedResult: "Lebih banyak leads.",
      },
      shortTerm: {
        action: "Pantau frequency.",
        how: "Cek dashboard harian.",
        why: "Antisipasi jenuh.",
        expectedResult: "Deteksi dini.",
      },
      mediumTerm: {
        action: "Siapkan creative baru.",
        how: "Brief Kai.",
        why: "Jaga sustainability.",
        expectedResult: "Scale berkelanjutan.",
      },
    },
    kaiDirective: { needed: false },
    budgetDecision: {
      recommendation: "increase",
      currentBudget: 500_000,
      recommendedBudget: 600_000,
      changePercent: 20,
      reasoning: "CPL efisien, ruang scale masih ada.",
    },
    scenarios: [
      {
        name: "Scale bertahap",
        probability: "70%",
        steps: ["Naikkan budget 20%"],
        expectedOutcome: "+5-8 leads/minggu.",
        timeToResult: "5-7 hari",
      },
      {
        name: "Pertahankan",
        probability: "30%",
        steps: ["Biarkan tetap"],
        expectedOutcome: "Stabil.",
        timeToResult: "N/A",
      },
    ],
    learnings: ["CPL rendah = ruang scale aman."],
    ...overrides,
  };
}

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
        new Response(JSON.stringify(validInsight()), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
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
    const body = JSON.parse(insightCall[1]!.body as string) as Record<string, unknown>;
    expect(body["campaignId"]).toBe("camp-1");
    expect(body["spend"]).toBe(1_000_000);
    expect(body["totalLead"]).toBe(10);
    expect(body["benchmarkCplIDR"]).toBe(150_000);
    // SAMANTHA ADVANCED INSIGHT ENGINE — real dailyBudget/cpc/cpm/reach must be included too.
    expect(body["dailyBudget"]).toBe(500_000);
    expect(body).toHaveProperty("cpc");
    expect(body).toHaveProperty("cpm");
    expect(body).toHaveProperty("reach");
  });

  // SAMANTHA ADVANCED SPRINT 2 — the campaign-insight request body must carry the real per-ad
  // breakdown and learning-ad-set list already loaded client-side, composed from `campaign.adSets`
  // (never a second Meta pull).
  it("composes the real per-ad breakdown and learning-ad-set stableIds into the /api/campaign-insight request", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify(validInsight()), { status: 200 }),
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
        benchmarkCtr={0.025}
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
        new Response(JSON.stringify(validInsight()), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
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
    const body = JSON.parse(insightCall[1]!.body as string) as { learningAdSetStableIds: string[] };
    expect(body.learningAdSetStableIds).toEqual([]);
  });

  // Real bug fix (live-confirmed report, same finding as VerdictCards.tsx's own fix): a delayed/
  // partial ad-level Meta Insights pull can leave every ad's spend at 0 (aggregate.spend === 0)
  // while campaign.spend (the real campaign-level Insights row) is non-zero.
  it("real bug fix: falls back to the real campaign.spend (with a warning badge) when the ad-level rollup is Rp 0, and sends that real spend to /api/campaign-insight instead of a misleading 0", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify(validInsight()), { status: 200 }),
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
        benchmarkCtr={0.025}
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
    mockFetchOnce(validInsight());
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
      <CampaignInsightPanel
        campaign={genuineZero}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("insight-kpi-spend")).toHaveTextContent("0");
    expect(screen.queryByTestId("metric-card-warning")).not.toBeInTheDocument();
  });

  it("renders the real triage level + verdict one-liner + confidence in the header once resolved", async () => {
    mockFetchOnce(
      validInsight({
        triage: { level: "KRITIS", why: "CTR turun 64% dalam 7 hari." },
        verdictOneLiner: "CPL murah tapi CTR jatuh — creative fatigue.",
        confidence: 82,
      }),
    );
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-verdict-oneliner")).toHaveTextContent(
        "CPL murah tapi CTR jatuh — creative fatigue.",
      ),
    );
    expect(screen.getByTestId("insight-triage-label")).toHaveTextContent("KRITIS");
    expect(screen.getByTestId("insight-triage")).toHaveTextContent("CTR turun 64% dalam 7 hari.");
    expect(screen.getByTestId("insight-confidence")).toHaveTextContent("82%");
  });

  it("renders the root cause primary/evidence/ruled_out block", async () => {
    mockFetchOnce(
      validInsight({
        rootCause: {
          primary: "Creative fatigue.",
          primaryEvidence: "CTR turun 64% dalam 7 hari.",
          ruled_out: "Bukan audience exhaustion — reach masih naik.",
        },
      }),
    );
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-root-cause")).toHaveTextContent("Creative fatigue."),
    );
    expect(screen.getByTestId("insight-root-cause")).toHaveTextContent(
      "CTR turun 64% dalam 7 hari.",
    );
    expect(screen.getByTestId("insight-ruled-out")).toHaveTextContent("Bukan audience exhaustion");
  });

  it("renders the whatHappened story and the metric breakdown list", async () => {
    mockFetchOnce(validInsight({ whatHappened: "Campaign berjalan stabil sejak awal bulan." }));
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-what-happened")).toHaveTextContent(
        "Campaign berjalan stabil sejak awal bulan.",
      ),
    );
    const breakdown = screen.getByTestId("insight-metric-breakdown");
    expect(breakdown).toHaveTextContent("CPL Rp100rb");
    expect(breakdown).toHaveTextContent("di bawah benchmark");
  });

  it("renders all 3 playbook phases (immediate/shortTerm/mediumTerm) with their real action/how/expectedResult", async () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-playbook-immediate")).toHaveTextContent("Naikkan budget."),
    );
    expect(screen.getByTestId("insight-playbook-shortTerm")).toHaveTextContent("Pantau frequency.");
    expect(screen.getByTestId("insight-playbook-mediumTerm")).toHaveTextContent(
      "Siapkan creative baru.",
    );
  });

  it("renders the Kai directive block with a real brief when needed, and points to the real Brief Kai action instead of duplicating it", async () => {
    mockFetchOnce(
      validInsight({
        kaiDirective: {
          needed: true,
          urgency: "immediate",
          brief: "Buat 5 creative baru angle lokasi.",
          angles_to_avoid: "Jangan variasi harga.",
        },
      }),
    );
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-kai-directive")).toHaveTextContent(
        "Buat 5 creative baru angle lokasi.",
      ),
    );
    expect(screen.getByTestId("insight-kai-directive")).toHaveTextContent("Jangan variasi harga.");
    expect(screen.getByTestId("insight-kai-directive")).toHaveTextContent("Brief Kai sekarang");
  });

  it("does NOT render the Kai directive block when needed is false", async () => {
    mockFetchOnce(validInsight({ kaiDirective: { needed: false } }));
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("insight-playbook")).toBeInTheDocument());
    expect(screen.queryByTestId("insight-kai-directive")).not.toBeInTheDocument();
  });

  it("renders the budget decision with real current/recommended/changePercent", async () => {
    mockFetchOnce(
      validInsight({
        budgetDecision: {
          recommendation: "pause",
          currentBudget: 750_000,
          recommendedBudget: 0,
          changePercent: -100,
          reasoning: "Pause sampai creative baru siap.",
          prerequisite: "Minimum 3 creative baru dari Kai.",
          opportunityCost: "3-5 hari pause = kehilangan 5-8 leads.",
        },
      }),
    );
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-budget-decision")).toHaveTextContent("Rp 750.000"),
    );
    expect(screen.getByTestId("insight-budget-decision")).toHaveTextContent("PAUSE");
    expect(screen.getByTestId("insight-budget-decision")).toHaveTextContent(
      "Minimum 3 creative baru dari Kai.",
    );
    expect(screen.getByTestId("insight-budget-decision")).toHaveTextContent(
      "3-5 hari pause = kehilangan 5-8 leads.",
    );
  });

  it("renders exactly 2 scenarios", async () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-scenarios")).toHaveTextContent("Scale bertahap"),
    );
    expect(screen.getByTestId("insight-scenarios")).toHaveTextContent("Pertahankan");
    expect(screen.getByTestId("insight-scenarios")).toHaveTextContent("70%");
    expect(screen.getByTestId("insight-scenarios")).toHaveTextContent("30%");
  });

  it("renders competitorContext/proTip/learnings only when the real response includes them", async () => {
    mockFetchOnce(
      validInsight({
        competitorContext: "CPM stabil, tidak ada lonjakan kompetisi.",
        proTip: "Frequency tinggi di Andromeda ≠ audience exhaustion.",
        learnings: ["Learning A", "Learning B"],
      }),
    );
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(screen.getByTestId("insight-competitor-context")).toHaveTextContent(
        "CPM stabil, tidak ada lonjakan kompetisi.",
      ),
    );
    expect(screen.getByTestId("insight-pro-tip")).toHaveTextContent(
      "Frequency tinggi di Andromeda ≠ audience exhaustion.",
    );
    expect(screen.getByTestId("insight-learnings")).toHaveTextContent("Learning A");
    expect(screen.getByTestId("insight-learnings")).toHaveTextContent("Learning B");
  });

  it("does NOT render competitorContext/proTip blocks when the real response honestly omits them", async () => {
    mockFetchOnce(validInsight({ competitorContext: undefined, proTip: undefined }));
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("insight-scenarios")).toBeInTheDocument());
    expect(screen.queryByTestId("insight-competitor-context")).not.toBeInTheDocument();
    expect(screen.queryByTestId("insight-pro-tip")).not.toBeInTheDocument();
  });

  it("shows a real verdict header badge, never fabricated when the verdict is neutral", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    // Every real ad in CAMPAIGN carries verdict "SCALE" -> aggregateVerdict resolves SCALE.
    expect(screen.getByTestId("insight-verdict-badge")).toHaveTextContent("SCALE");
  });

  it("does not render insight-verdict-oneliner before the LLM response resolves (no fabricated placeholder)", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    // Synchronously right after render, the fetch hasn't resolved yet.
    expect(screen.queryByTestId("insight-verdict-oneliner")).not.toBeInTheDocument();
  });

  it("honest degrade: renders the real 'belum tersedia' message, never a fabricated narrative, when available:false", async () => {
    mockFetchOnce({
      available: false,
      reason: "NO_API_KEY",
      message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
    });
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId("insight-unavailable")).toBeInTheDocument());
    expect(screen.getByTestId("insight-unavailable")).toHaveTextContent("Analisa belum tersedia");
  });

  it("shows the real 6-KPI grid computed from already-loaded data, not the LLM response", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
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
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("insight-objective")).toHaveTextContent("OUTCOME_LEADS");
  });

  it("renders the real ad-set/ad drill-down (CampaignAdDrillDown) for the selected campaign", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("insight-drilldown-block")).toBeInTheDocument();
    expect(screen.getByTestId("ad-drilldown")).toBeInTheDocument();
    expect(screen.getByTestId("open-adset-as1")).toBeInTheDocument();
  });

  it("links to the real A/B Testing escape hatch (?view=ab-testing), never silently dropped", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Kelola A/B Test ↗")).toHaveAttribute(
      "href",
      "/campaigns?view=ab-testing",
    );
  });

  // Campaign Page Rebuild v2 — real sparkline/delta data, fetched from the new
  // GET /api/campaigns/:metaId/history endpoint (meta_insights_daily read-back).
  it("fetches real 7-day history by the campaign's real, stable metaId (never the local, regenerated id)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/campaigns/") && url.includes("/history")) {
        return new Response(JSON.stringify({ campaignId: "camp-1", points: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(validInsight()), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => String(url) === "/api/campaigns/camp-1/history?days=7",
        ),
      ).toBe(true),
    );
  });

  it("real, honest sparkline: renders a sparkline on the CPL card once real history resolves", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/campaigns/") && url.includes("/history")) {
        return new Response(
          JSON.stringify({
            campaignId: "camp-1",
            points: [
              {
                date: "2026-09-09",
                spend: 1,
                impressions: 1,
                clicks: 1,
                frequency: 1,
                ctr: 1,
                cpl: 90_000,
                leads: 1,
              },
              {
                date: "2026-09-10",
                spend: 1,
                impressions: 1,
                clicks: 1,
                frequency: 1,
                ctr: 1,
                cpl: 100_000,
                leads: 1,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(validInsight()), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        within(screen.getByTestId("insight-kpi-cpl")).getByTestId("metric-card-sparkline"),
      ).toBeInTheDocument(),
    );
  });

  it("real CPL-vs-benchmark bar: renders with an honest 'lebih murah'/'lebih mahal' note, never shown with no real benchmark", () => {
    mockFetchOnce(validInsight());
    const cheaperCampaign: CampaignSummaryDto = {
      ...CAMPAIGN,
      adSets: [
        {
          ...CAMPAIGN.adSets[0]!,
          ads: [ad({ metrics: metrics({ spend: 500_000, totalLead: 10 }) })], // cpl = 50_000
        },
      ],
    };
    render(
      <CampaignInsightPanel
        campaign={cheaperCampaign}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("insight-cpl-bar")).toBeInTheDocument();
    expect(screen.getByTestId("insight-cpl-bar-note")).toHaveTextContent(
      /lebih murah dari benchmark/,
    );
  });

  it("does not render the CPL bar at all when there is honestly no real benchmark to compare against", () => {
    mockFetchOnce(validInsight());
    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={null}
        benchmarkCtr={null}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("insight-cpl-bar")).not.toBeInTheDocument();
  });

  // SAMANTHA ADVANCED INSIGHT ENGINE — real, best-effort andromeda-health + hot-leads fetches must
  // fire (feeding the campaign-insight request whenever they happen to resolve in time — same
  // best-effort "uses whatever value is held right now" convention `marketDigest`/`history` already
  // established) but must never block or fail the rest of the panel.
  it("fires real, best-effort fetches for andromeda-health and /api/leads (for andromedaDiversity/hotLeadsCount)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/andromeda-health")) {
        return new Response(
          JSON.stringify({
            campaignId: "camp-1",
            campaignName: "Xpander Bintaro",
            adSetCount: 1,
            diversity: {
              status: "LOW_DIVERSITY",
              totalAdCount: 2,
              distinctCreativeAssetCount: 1,
              reasoning: "Hanya 1 creative unik.",
            },
            evaluation: { triggered: false },
          }),
          { status: 200 },
        );
      }
      if (url === "/api/leads") {
        return new Response(JSON.stringify({ leads: [] }), { status: 200 });
      }
      return new Response(JSON.stringify(validInsight()), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url]) => String(url) === "/api/campaigns/camp-1/andromeda-health",
        ),
      ).toBe(true),
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/leads")).toBe(true);
  });

  it("degrades honestly when the andromeda-health/leads best-effort fetches fail — the panel still renders the real insight", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/andromeda-health") || url === "/api/leads") {
        return new Response(JSON.stringify({ error: "boom" }), { status: 500 });
      }
      return new Response(JSON.stringify(validInsight()), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CampaignInsightPanel
        campaign={CAMPAIGN}
        benchmarkCplIDR={150_000}
        benchmarkCtr={0.025}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("insight-verdict-oneliner")).toBeInTheDocument());
  });

  // SAMANTHA META ADS SETTINGS + CREATIVE COPY — lazy-loaded accordion: only fetched once
  // expanded, never on mount alongside the diagnosis panel's own fetch.
  describe("settings recommendation accordion", () => {
    function settingsRecommendationFixture() {
      return {
        available: true,
        audienceSettings: {
          strategy: "BROAD_ADVANTAGE_PLUS",
          strategyRationale: "x",
          geoTargeting: {
            locations: [{ name: "BSD City", radiusKm: 15, radiusRationale: "x" }],
            excluded: [],
            geoRationale: "x",
          },
          demographics: { ageMin: 28, ageMax: 55, gender: "all", ageRationale: "x" },
          interestTargeting: {
            use: false,
            useRationale: "x",
            interests: [],
            interestStacking: false,
          },
          customAudiences: {
            retargeting: { recommended: false, rationale: "x" },
            lookalike: { recommended: false, rationale: "x" },
          },
          specialAdCategory: { required: true, category: "HOUSING", implications: "x" },
        },
        campaignSettings: {
          objective: "OUTCOME_LEADS",
          objectiveRationale: "x",
          buyingType: "AUCTION",
          campaignBudgetOptimization: false,
          cboRationale: "x",
          bidStrategy: "LOWEST_COST",
          bidStrategyRationale: "x",
          adSchedule: { use: false, rationale: "x" },
        },
        adSetSettings: {
          structure: "x",
          optimizationGoal: "LEAD_GENERATION",
          optimizationRationale: "x",
          billingEvent: "IMPRESSIONS",
          budgetRecommendation: {
            dailyBudget: 500_000,
            minViable: 300_000,
            idealForLearning: 1_000_000,
            rationale: "x",
          },
          placementStrategy: {
            type: "ADVANTAGE_PLUS",
            placements: ["Facebook Feed"],
            excluded: [],
            rationale: "x",
          },
        },
        creativeRecommendations: {
          diversityTarget: "x",
          copies: [
            {
              angle: "DP_RINGAN",
              targetPersona: "x",
              hook: "x",
              headline: "x",
              primaryText: "x",
              description: "x",
              cta: "Send Message",
              recommendedFormat: "IMAGES_ONLY",
              visualDirection: "x",
              whyThisWorks: "x",
            },
          ],
          copyPrinciples: [],
          abTestMatrix: [],
        },
        trackingSetup: {
          pixelRequired: true,
          capi: { required: true, rationale: "x", eventsToTrack: ["Lead"] },
          utmParams: { template: "x", rationale: "x" },
          waLinkSetup: "x",
        },
        settingsSummaryCard: {
          oneLineRecommendation: "Gunakan broad targeting.",
          topPriorityChange: "x",
          estimatedImpact: "x",
        },
      };
    }

    it("does NOT fetch the settings recommendation until the accordion is expanded", async () => {
      const fetchMock = vi.fn(
        async (_url: string, _init?: RequestInit) =>
          new Response(JSON.stringify(validInsight()), { status: 200 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;
      render(
        <CampaignInsightPanel
          campaign={CAMPAIGN}
          benchmarkCplIDR={150_000}
          benchmarkCtr={0.025}
          onClose={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId("settings-toggle")).toBeInTheDocument());
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("settings-recommendation")),
      ).toBe(false);
    });

    it("fetches and renders the real settings recommendation once expanded", async () => {
      const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
        if (url.includes("settings-recommendation")) {
          return new Response(JSON.stringify(settingsRecommendationFixture()), { status: 200 });
        }
        return new Response(JSON.stringify(validInsight()), { status: 200 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      render(
        <CampaignInsightPanel
          campaign={CAMPAIGN}
          benchmarkCplIDR={150_000}
          benchmarkCtr={0.025}
          onClose={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId("settings-toggle")).toBeInTheDocument());
      await userEvent.click(screen.getByTestId("settings-toggle"));

      await waitFor(() => expect(screen.getByTestId("meta-settings-panel")).toBeInTheDocument());
      expect(screen.getByTestId("settings-one-liner")).toHaveTextContent(
        "Gunakan broad targeting.",
      );

      const insightCall = fetchMock.mock.calls.find(([url]) =>
        String(url).includes("settings-recommendation"),
      )!;
      expect(insightCall[0]).toBe("/api/campaigns/camp-1/settings-recommendation");
      const body = JSON.parse((insightCall[1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body["campaignId"]).toBe("camp-1");
      expect(body["benchmarkCtr"]).toBe(0.025);
    });

    it("shows the real 'belum tersedia' degrade, never a fabricated recommendation, when available:false", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("settings-recommendation")) {
          return new Response(
            JSON.stringify({ available: false, reason: "NO_API_KEY", message: "test" }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(validInsight()), { status: 200 });
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      render(
        <CampaignInsightPanel
          campaign={CAMPAIGN}
          benchmarkCplIDR={150_000}
          benchmarkCtr={0.025}
          onClose={vi.fn()}
        />,
      );
      await waitFor(() => expect(screen.getByTestId("settings-toggle")).toBeInTheDocument());
      await userEvent.click(screen.getByTestId("settings-toggle"));
      await waitFor(() => expect(screen.getByTestId("settings-unavailable")).toBeInTheDocument());
    });
  });
});
