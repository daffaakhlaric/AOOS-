import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/components/dashboard/DashboardClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LEADS_BODY = {
  leads: [
    {
      id: "lead-1",
      leadPhone: "+6281200000001",
      leadName: "Pak Andi",
      branchId: "CINERE",
      status: "NEW",
      temperature: "HOT",
      score: 90,
      createdAt: new Date().toISOString(),
    },
  ],
};
const OBJECTIVE_BODY = {
  objective: {
    id: "obj-1",
    tenantId: "dss-motor",
    period: { month: 8, year: 2026 },
    targetHotLeads: 50,
    budgetAllocation: 30_000_000,
    focusUnits: ["Xpander"],
    areaPriorities: ["BINTARO"],
    status: "DRAFT",
    createdAt: "2026-08-01T00:00:00.000Z",
  },
};

describe("DashboardClient (real bug fix: no longer fetches /api/campaigns — Meta Ads data, see DashboardClient.tsx's docstring)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders KPI cards (Hot Lead + Closing only, no Belanja/D3 Lead) + objective progress + hot leads once leads/objective fetches succeed", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/leads")) return jsonResponse(LEADS_BODY);
      if (url.includes("/api/objective")) return jsonResponse(OBJECTIVE_BODY);
      throw new Error(`unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByTestId("objective-progress")).toBeInTheDocument();
    expect(screen.queryByText(/Belanja/)).not.toBeInTheDocument();
    expect(screen.queryByText(/D3 Lead/)).not.toBeInTheDocument();
  });

  it("never calls /api/campaigns (Meta Ads data) — the dashboard overview only reads Supabase-backed leads/objective data", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/leads")) return jsonResponse(LEADS_BODY);
      if (url.includes("/api/objective")) return jsonResponse(OBJECTIVE_BODY);
      throw new Error(`unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    const calledCampaigns = fetchMock.mock.calls.some(([url]) =>
      String(url).includes("/api/campaigns"),
    );
    expect(calledCampaigns).toBe(false);
  });

  it("shows an error card when a fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("omits ObjectiveProgress when there is no current objective", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/leads")) return jsonResponse({ leads: [] });
      if (url.includes("/api/objective")) return jsonResponse({ objective: null });
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    render(<DashboardClient />);
    await waitFor(() => expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument());
    expect(screen.queryByTestId("objective-progress")).not.toBeInTheDocument();
  });
});
