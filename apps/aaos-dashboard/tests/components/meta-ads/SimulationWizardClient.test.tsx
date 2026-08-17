import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SimulationWizardClient } from "@/components/meta-ads/SimulationWizardClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto, SimulationStatusDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function metrics(overrides: Partial<AdAccountSummaryDto["totals"]> = {}) {
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

const DATA: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [],
  ads: [
    {
      id: "ad-refresh",
      stableId: "#C001",
      name: "Xpander Cross 2019",
      campaignName: "Campaign A",
      status: "ACTIVE",
      funnel: "DM",
      branch: "CINERE",
      verdict: "REFRESH",
      metrics: metrics({ frequency: 4.1 }),
    },
    {
      id: "ad-fine",
      stableId: "#C002",
      name: "Ad Fine",
      campaignName: "Campaign B",
      status: "ACTIVE",
      funnel: "DM",
      branch: "UMUM",
      verdict: "KEEP",
      metrics: metrics({ frequency: 1.2 }),
    },
  ],
  totals: metrics({}),
  campaignCount: 2,
  adCount: 2,
};

const DONE_STATUS: SimulationStatusDto = {
  id: "sim-1",
  status: "DONE",
  currentStep: "REVIEW",
  campaignDataSource: "cache",
  personaIds: ["ready_buyer"],
  logs: [
    {
      step: "TAMARA",
      level: "INFO",
      message: "Tamara selesai.",
      createdAt: "2026-08-13T00:00:00.000Z",
    },
  ],
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:05.000Z",
  result: {
    tamara: {
      available: true,
      temuan: [{ icon: "🔴", judul: "Frequency tinggi", detail: "detail" }],
      rekomendasi: [{ aksi: "FIX", target: "#C001", alasan: "alasan", estimasi: "hemat" }],
      ringkasan: "Ringkasan Tamara.",
      elapsedMs: 1200,
      coverageScore: 80,
    },
    kai: {
      available: true,
      brief: {
        unit: "Xpander Cross 2019",
        angle: "DP_RINGAN",
        branch: "CINERE",
        primaryMessage: "DP mulai 29 juta",
        tone: "casual",
        formats: ["VIDEO_15S"],
        avoid: [],
        urgency: "HIGH",
      },
      elapsedMs: 800,
      videoGenerated: false,
      note: "Video belum digenerate.",
    },
    jessy: {
      available: true,
      runs: [
        {
          personaId: "ready_buyer",
          ok: true,
          overallScore: 88,
          grade: "B",
          verdict: "APPROVED",
        },
      ],
      elapsedMs: 500,
    },
    scoring: {
      tamaraCoverageScore: 80,
      kaiScore: 100,
      jessyScore: 88,
      overallScore: 85.8,
      grade: "B",
      verdict: "GO",
    },
  },
};

describe("SimulationWizardClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(overrides: Record<string, () => Response | Promise<Response>> = {}): void {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      for (const [pattern, handler] of Object.entries(overrides)) {
        if (url.includes(pattern)) {
          return handler();
        }
      }
      if (url.includes("/api/objective")) return jsonResponse({ objective: null });
      return jsonResponse({ error: { message: "unhandled in test" } }, 500);
    }) as unknown as typeof fetch;
  }

  it("shows the empty state when there is no cached campaign data", async () => {
    mockFetch();
    render(<SimulationWizardClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("Setup step lists every real ad (not just ones needing refresh) — real bug fix, an account with nothing flagged for refresh must still be able to start a simulation", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch();
    render(<SimulationWizardClient />);

    const setup = await screen.findByTestId("wizard-step-setup");
    // Both the refresh-flagged ad and the unrelated "fine" ad are selectable.
    expect(setup.textContent).toContain("Xpander Cross 2019");
    expect(setup.textContent).toContain("Ad Fine");
    // Only the one that actually needs a refresh (verdict=REFRESH or frequency >= 3.5) is flagged.
    expect(screen.getByRole("button", { name: /⚠ #C001 Xpander Cross 2019/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^#C002 Ad Fine/ })).toBeInTheDocument();
  });

  it("'Mulai Simulasi Dry-Run' is not permanently stuck disabled when no ad needs a refresh", async () => {
    const noRefreshNeeded: AdAccountSummaryDto = {
      ...DATA,
      ads: [{ ...DATA.ads[1]!, id: "ad-only" }],
    };
    writeCampaignsCache({ data: noRefreshNeeded, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch();
    render(<SimulationWizardClient />);

    await userEvent.click(await screen.findByRole("button", { name: /Ad Fine/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    expect(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ })).not.toBeDisabled();
  });

  it("starting a simulation posts to /api/simulation/start and renders the polled pipeline status", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    let startCallBody: unknown;
    mockFetch({
      "/api/simulation/start": () => {
        return (async () => {
          // capture the body via a side-channel since this mock only returns a Response
          return jsonResponse({ id: "sim-1", status: "RUNNING" }, 202);
        })();
      },
      "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
    });
    // Wrap fetch to also capture the start request body for assertion below.
    const realFetch = global.fetch;
    global.fetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("/api/simulation/start") && init?.body !== undefined) {
        startCallBody = JSON.parse(String(init.body));
      }
      return realFetch(input as never, init);
    }) as unknown as typeof fetch;

    render(<SimulationWizardClient />);

    await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));

    await waitFor(() => expect(screen.getByTestId("wizard-pipeline")).toBeInTheDocument());
    expect(startCallBody).toMatchObject({
      campaignDataSource: "cache",
      personaIds: ["ready_buyer"],
      kaiBranch: "CINERE",
    });

    await waitFor(() => expect(screen.getByText("Ringkasan Tamara.")).toBeInTheDocument());
    expect(screen.getByText("DP mulai 29 juta")).toBeInTheDocument();
    expect(screen.getByText(/88 \(B\)/)).toBeInTheDocument();

    // Step 6 review renders once the run is DONE with a real scored result.
    expect(await screen.findByTestId("wizard-step-review")).toBeInTheDocument();
    expect(screen.getByText("85.8")).toBeInTheDocument();
    expect(screen.getByText("GO")).toBeInTheDocument();
  });

  it("Approve on Step 6 records the decision via /api/simulation/:id/approve", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch({
      "/api/simulation/start": () => jsonResponse({ id: "sim-1", status: "RUNNING" }, 202),
      "/api/simulation/sim-1/status": () => jsonResponse(DONE_STATUS),
      "/api/simulation/sim-1/approve": () =>
        jsonResponse({
          ...DONE_STATUS,
          decision: "APPROVED",
          decidedAt: "2026-08-13T00:00:10.000Z",
        }),
    });

    render(<SimulationWizardClient />);
    await userEvent.click(await screen.findByRole("button", { name: /Xpander Cross 2019/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ready Buyer" }));
    await userEvent.click(screen.getByRole("button", { name: /Mulai Simulasi Dry-Run/ }));

    await screen.findByTestId("wizard-step-review");
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(screen.getByText(/Keputusan tercatat/)).toBeInTheDocument());
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });

  it("shows an error card (not a silently blank section) when /api/objective returns a non-2xx response", async () => {
    writeCampaignsCache({ data: DATA, fetchedAt: Date.now(), period: "last_30d" });
    mockFetch({
      "/api/objective": () => jsonResponse({ error: { message: "Gagal memuat objective." } }, 500),
    });
    render(<SimulationWizardClient />);

    const setup = await screen.findByTestId("wizard-step-setup");
    expect(await screen.findByText("Gagal memuat objective.")).toBeInTheDocument();
    // Real bug fix regression guard: the rest of Step 1 (ad list, persona picker) still renders —
    // an objective fetch failure must not blank out the whole setup step.
    expect(setup.textContent).toContain("Xpander Cross 2019");
  });

  it("history toggle loads /api/simulation/history", async () => {
    mockFetch({
      "/api/simulation/history": () =>
        jsonResponse({
          history: [
            {
              id: "sim-old",
              status: "DONE",
              overallScore: 72.5,
              grade: "C",
              verdict: "GO",
              createdAt: "2026-08-10T00:00:00.000Z",
              updatedAt: "2026-08-10T00:05:00.000Z",
            },
          ],
        }),
    });

    render(<SimulationWizardClient />);
    await userEvent.click(await screen.findByRole("button", { name: "Riwayat" }));
    await waitFor(() => expect(screen.getByText(/72.5/)).toBeInTheDocument());
  });
});
