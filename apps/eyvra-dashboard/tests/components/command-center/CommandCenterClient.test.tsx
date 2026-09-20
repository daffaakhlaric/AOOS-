import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandCenterClient } from "@/components/command-center/CommandCenterClient";
import type {
  AbTestDto,
  AdMetricsDto,
  AdSummaryDto,
  CampaignSummaryDto,
  OverviewResponseDto,
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

function campaignWith(id: string, verdict: string): CampaignSummaryDto {
  return {
    id,
    metaId: id,
    stableId: `#A-${id}`,
    name: `Campaign ${id}`,
    objective: "OUTCOME_LEADS",
    status: "ACTIVE",
    spend: 1_000_000,
    dailyBudget: 0,
    adSets: [
      {
        id: `as-${id}`,
        metaId: `as-${id}`,
        stableId: `#B-${id}`,
        name: "AdSet",
        status: "ACTIVE",
        spend: 1_000_000,
        dailyBudget: 500_000,
        ads: [ad({ id: `ad-${id}`, verdict })],
      },
    ],
  };
}

function baseOverview(overrides: Partial<OverviewResponseDto> = {}): OverviewResponseDto {
  return {
    tenantId: "tenant-1",
    generatedAt: new Date().toISOString(),
    leads: { hot: 3, warm: 2, cold: 1, hotToday: 1, hotYesterday: 2, hotDeltaVsYesterday: -1 },
    campaigns: {
      adAccountId: "act_1",
      datePreset: "last_30d",
      activeCampaignsCount: 2,
      totalCampaignsCount: 2,
      totalSpend: 2_000_000,
      campaigns: [campaignWith("fix", "FIX"), campaignWith("scale", "SCALE")],
    },
    agentStatus: [
      {
        agent: "SAMANTHA",
        todayAverageOverall: 82,
        priorSevenDayAverageOverall: 80,
        delta: 2,
        todaySampleSize: 4,
        priorSevenDaySampleSize: 20,
        actionsToday: 5,
      },
      {
        agent: "KAI",
        todaySampleSize: 0,
        priorSevenDaySampleSize: 0,
        actionsToday: 0,
      },
      {
        agent: "CLARA",
        todaySampleSize: 0,
        priorSevenDaySampleSize: 0,
        actionsToday: 0,
      },
    ],
    activities: [],
    insight: {
      available: true,
      summary: "Semua campaign dalam kondisi baik.",
      perAgent: { samantha: "ok", kai: "ok", clara: "ok" },
    },
    errors: {},
    ...overrides,
  };
}

function mockFetchOnce(overview: OverviewResponseDto, tests: readonly AbTestDto[] = []): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/overview")) {
        return Promise.resolve(new Response(JSON.stringify(overview), { status: 200 }));
      }
      if (url.startsWith("/api/abtesting")) {
        return Promise.resolve(new Response(JSON.stringify({ tests }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
    }),
  );
}

describe("CommandCenterClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the real KPI strip from /api/overview's aggregate spend/leads (never CPQL/Bookings)", async () => {
    mockFetchOnce(baseOverview());
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    const kpiStrip = screen.getByTestId("cc-kpi-strip");
    expect(within(kpiStrip).getByText("Total Spend")).toBeInTheDocument();
    expect(within(kpiStrip).getByText("Total Leads")).toBeInTheDocument();
    expect(within(kpiStrip).getByText("CPL")).toBeInTheDocument();
    expect(screen.queryByText(/CPQL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Bookings/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qualified Leads/)).not.toBeInTheDocument();
  });

  it("buckets the real FIX verdict into Needs Attention and SCALE into Opportunities", async () => {
    mockFetchOnce(baseOverview());
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    const attention = screen.getByTestId("cc-panel-attention");
    expect(attention).toHaveTextContent("Campaign fix");
    expect(attention).not.toHaveTextContent("Campaign scale");

    const opportunity = screen.getByTestId("cc-panel-opportunity");
    expect(opportunity).toHaveTextContent("Campaign scale");
    expect(opportunity).not.toHaveTextContent("Campaign fix");
  });

  it("renders the Attention Queue table with every actionable campaign, honestly omitting KEEP/REVIEW", async () => {
    mockFetchOnce(
      baseOverview({
        campaigns: {
          adAccountId: "act_1",
          datePreset: "last_30d",
          activeCampaignsCount: 3,
          totalCampaignsCount: 3,
          totalSpend: 3_000_000,
          campaigns: [
            campaignWith("fix", "FIX"),
            campaignWith("scale", "SCALE"),
            campaignWith("keep", "KEEP"),
          ],
        },
      }),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("cc-attention-queue")).toBeInTheDocument());

    expect(screen.getByTestId("cc-queue-row-fix")).toBeInTheDocument();
    expect(screen.getByTestId("cc-queue-row-scale")).toBeInTheDocument();
    expect(screen.queryByTestId("cc-queue-row-keep")).not.toBeInTheDocument();
  });

  it("shows a real, honest empty state (not a fabricated table) when no campaign is actionable", async () => {
    mockFetchOnce(
      baseOverview({
        campaigns: {
          adAccountId: "act_1",
          datePreset: "last_30d",
          activeCampaignsCount: 1,
          totalCampaignsCount: 1,
          totalSpend: 1_000_000,
          campaigns: [campaignWith("keep", "KEEP")],
        },
      }),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());
    expect(screen.getByText("Tidak ada campaign yang butuh aksi")).toBeInTheDocument();
  });

  it("honestly degrades the KPI strip and campaign panels when /api/overview has no real campaigns section", async () => {
    mockFetchOnce(
      baseOverview({
        leads: undefined,
        campaigns: undefined,
        errors: { campaigns: "Meta Ads belum terhubung." },
      }),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());

    expect(screen.getAllByText("Meta Ads belum terhubung.").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("cc-kpi-strip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cc-panel-attention")).not.toBeInTheDocument();
  });

  it("keeps showing Total Leads honestly even when only the campaigns section is missing", async () => {
    mockFetchOnce(
      baseOverview({
        campaigns: undefined,
        errors: { campaigns: "Meta Ads belum terhubung." },
      }),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("cc-kpi-strip")).toBeInTheDocument());

    const kpiStrip = screen.getByTestId("cc-kpi-strip");
    expect(within(kpiStrip).getByText("Total Leads")).toBeInTheDocument();
    expect(within(kpiStrip).queryByText("Total Spend")).not.toBeInTheDocument();
    expect(within(kpiStrip).queryByText("CPL")).not.toBeInTheDocument();
  });

  it("renders real running experiments from GET /api/abtesting?status=RUNNING", async () => {
    mockFetchOnce(baseOverview(), [
      {
        id: "test-1",
        name: "Hook A vs Hook B",
        campaignId: "fix",
        adSetId: "as-fix",
        status: "RUNNING",
        thresholdSpend: 500_000,
        thresholdDays: 3,
        minMarginPct: 10,
        autoPauseLoser: true,
        autoScaleWinner: true,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        variants: [
          {
            id: "v1",
            variantLabel: "A",
            angle: "Angle A",
            creativePackageId: "pkg-1",
            status: "ACTIVE",
            spend: 200_000,
            impressions: 1000,
            clicks: 50,
            conversations: 5,
            leads: 3,
          },
          {
            id: "v2",
            variantLabel: "B",
            angle: "Angle B",
            creativePackageId: "pkg-2",
            status: "ACTIVE",
            spend: 200_000,
            impressions: 1000,
            clicks: 40,
            conversations: 4,
            leads: 2,
          },
        ],
      },
    ]);
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("cc-active-experiments")).toBeInTheDocument());
    expect(screen.getByText("Hook A vs Hook B")).toBeInTheDocument();
  });

  it("shows an honest 'belum tersedia' state for Kai Creative Production, never a fabricated number", async () => {
    mockFetchOnce(baseOverview());
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("command-center")).toBeInTheDocument());
    expect(screen.getByText("Kai Creative Production")).toBeInTheDocument();
    expect(
      screen.getByText(/Belum ada agregat real-time untuk antrian produksi creative Kai/),
    ).toBeInTheDocument();
  });

  it("shows an honest error state when /api/overview itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({}), { status: 500 }))),
    );
    render(<CommandCenterClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
