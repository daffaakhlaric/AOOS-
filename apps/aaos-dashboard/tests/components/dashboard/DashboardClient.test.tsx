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
const CAMPAIGNS_BODY = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  ads: [],
  totals: {
    spend: 26_400_000,
    conversations: 0,
    d2: 0,
    d3: 1286,
    d5: 0,
    leadForm: 0,
    totalLead: 0,
    rphD3: null,
  },
};

describe("DashboardClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders KPI cards + objective progress + hot leads once all 3 fetches succeed", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = input.toString();
      if (url.includes("/api/leads")) return jsonResponse(LEADS_BODY);
      if (url.includes("/api/objective")) return jsonResponse(OBJECTIVE_BODY);
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Rp 26.4jt")).toBeInTheDocument();
    expect(screen.getByTestId("objective-progress")).toBeInTheDocument();
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
      return jsonResponse(CAMPAIGNS_BODY);
    }) as unknown as typeof fetch;

    render(<DashboardClient />);
    await waitFor(() => expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument());
    expect(screen.queryByTestId("objective-progress")).not.toBeInTheDocument();
  });
});
