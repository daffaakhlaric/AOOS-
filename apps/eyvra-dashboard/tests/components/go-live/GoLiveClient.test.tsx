import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GoLiveClient } from "@/components/go-live/GoLiveClient";
import type { AdAccountSummaryDto, SimulationStatusDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LIVE_SIM: SimulationStatusDto = {
  id: "sim-1",
  status: "LIVE",
  currentStep: "DONE",
  campaignDataSource: "cache",
  personaIds: ["ready_buyer"],
  decision: "APPROVED",
  liveCampaignId: "campaign-1",
  liveAdId: "ad-1",
  liveAt: "2026-08-13T01:00:00.000Z",
  logs: [
    {
      step: "GO_LIVE",
      level: "INFO",
      message: "Campaign dibuat",
      createdAt: "2026-08-13T01:00:00.000Z",
    },
  ],
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T01:00:00.000Z",
};

const CAMPAIGNS_DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix",
  syncedAt: "2026-08-13T01:00:00.000Z",
  campaigns: [
    {
      id: "campaign-1",
      metaId: "campaign-1",
      stableId: "#A001",
      name: "GoLive campaign",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 150_000,
      dailyBudget: 0,
      adSets: [
        {
          id: "adset-1",
          metaId: "adset-1",
          stableId: "#B001",
          name: "adset",
          status: "ACTIVE",
          spend: 150_000,
          dailyBudget: 100_000,
          ads: [
            {
              id: "ad-1",
              metaId: "ad-1",
              stableId: "#C001",
              name: "ad",
              status: "ACTIVE",
              funnel: "CTWA",
              branch: "CINERE",
              verdict: "KEEP",
              metrics: {
                spend: 150_000,
                clicks: 10,
                frequency: 1,
                conversations: 5,
                d2: 1,
                d3: 1,
                d5: 0,
                leadForm: 0,
                totalLead: 3,
                rphD3: null,
                rphLead: null,
              },
            },
          ],
        },
      ],
    },
  ],
  ads: [],
  totals: {
    spend: 150_000,
    clicks: 10,
    frequency: 0,
    conversations: 5,
    d2: 1,
    d3: 1,
    d5: 0,
    leadForm: 0,
    totalLead: 3,
    rphD3: null,
    rphLead: null,
  },
  campaignCount: 1,
  adCount: 1,
};

function mockFetch(overrides: Record<string, () => Response | Promise<Response>> = {}): void {
  global.fetch = vi.fn(async (input: string | URL) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        return handler();
      }
    }
    return jsonResponse({ error: { message: "unhandled in test" } }, 500);
  }) as unknown as typeof fetch;
}

describe("GoLiveClient (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty state when GET /api/simulation/live returns no rows", async () => {
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ live: [] }),
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
    });
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByText("Belum ada campaign live")).toBeInTheDocument());
  });

  it("renders a real KPI strip and a card per LIVE simulation, matched against real campaign data", async () => {
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ live: [LIVE_SIM] }),
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
    });
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByTestId("go-live-kpi-strip")).toBeInTheDocument());
    expect(screen.getByTestId("go-live-card-sim-1")).toBeInTheDocument();
    expect(screen.getAllByText(/Rp 150.000/)).toHaveLength(2);
    expect(screen.getByText(/Status Meta: ACTIVE/)).toBeInTheDocument();
  });

  it("shows an honest 'belum tersinkron' note when the campaign isn't found in /api/campaigns yet", async () => {
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ live: [LIVE_SIM] }),
      "/api/campaigns": () => jsonResponse({ ...CAMPAIGNS_DATA, campaigns: [] }),
    });
    render(<GoLiveClient />);
    await waitFor(() =>
      expect(screen.getByText("Data campaign belum tersinkron dari Meta.")).toBeInTheDocument(),
    );
  });

  it("Pause posts to /api/simulation/:id/pause and refreshes", async () => {
    let paused = false;
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ live: [LIVE_SIM] }),
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
      "/api/simulation/sim-1/pause": () => {
        paused = true;
        return jsonResponse(LIVE_SIM);
      },
    });
    render(<GoLiveClient />);
    await screen.findByTestId("go-live-card-sim-1");
    await userEvent.click(screen.getByRole("button", { name: /Pause/ }));
    await waitFor(() => expect(paused).toBe(true));
  });

  it("Rollback posts to /api/simulation/:id/rollback and refreshes to an empty LIVE list", async () => {
    let rolledBack = false;
    mockFetch({
      "/api/simulation/live": () => {
        return jsonResponse({ live: rolledBack ? [] : [LIVE_SIM] });
      },
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
      "/api/simulation/sim-1/rollback": () => {
        rolledBack = true;
        return jsonResponse({ ...LIVE_SIM, status: "ROLLED_BACK" });
      },
    });
    render(<GoLiveClient />);
    await screen.findByTestId("go-live-card-sim-1");
    await userEvent.click(screen.getByRole("button", { name: /Rollback/ }));
    await waitFor(() => expect(screen.getByText("Belum ada campaign live")).toBeInTheDocument());
  });

  it("Detail toggles the real GO_LIVE log lines", async () => {
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ live: [LIVE_SIM] }),
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
    });
    render(<GoLiveClient />);
    await screen.findByTestId("go-live-card-sim-1");
    expect(screen.queryByTestId("go-live-detail-sim-1")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Detail/ }));
    expect(screen.getByTestId("go-live-detail-sim-1")).toBeInTheDocument();
    expect(screen.getByText(/Campaign dibuat/)).toBeInTheDocument();
  });

  it("shows an error card when GET /api/simulation/live fails", async () => {
    mockFetch({
      "/api/simulation/live": () => jsonResponse({ error: { message: "boom" } }, 500),
      "/api/campaigns": () => jsonResponse(CAMPAIGNS_DATA),
    });
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
