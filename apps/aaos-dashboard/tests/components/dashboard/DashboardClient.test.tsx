import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { CAMPAIGNS_CACHE_KEY } from "@/lib/campaignsCache";

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
const CLOSINGS_BODY = {
  closings: [
    {
      id: "closing-1",
      leadId: "lead-1",
      salesHumanId: "sales-1",
      branchId: "CINERE",
      closingType: "SPK",
      unitModel: "Xpander Cross AT 2019",
      commissionIdr: 5_850_000,
      createdAt: new Date().toISOString(),
    },
  ],
};
const BRANCHES_BODY = {
  branches: [
    {
      id: "CINERE",
      name: "cinere",
      displayName: "Cinere",
      wabaPhoneNumber: "+6281200000000",
      assignmentMode: "SMART_ASSIGN",
      maxLeadsPerSalesPerDay: 10,
      active: true,
      team: [
        {
          id: "sales-1",
          name: "Ahmad Fauzi",
          waNumber: "+6281200000002",
          status: "ON",
          maxLeadsPerDay: 10,
          todayLeadCount: 1,
          isAvailable: true,
        },
      ],
      availableCount: 1,
      queueSize: 0,
      todayAssignedCount: 1,
    },
  ],
};

function mockFetchOk(): void {
  global.fetch = vi.fn(async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/api/leads")) return jsonResponse(LEADS_BODY);
    if (url.includes("/api/closings")) return jsonResponse(CLOSINGS_BODY);
    if (url.includes("/api/branches")) return jsonResponse(BRANCHES_BODY);
    if (url.includes("/api/calendar")) return jsonResponse({ events: [] });
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("DashboardClient (FINAL UI REBUILD: KPI strip + Tamara Digest + Hot Leads/Closing Terbaru + Ringkasan per Cabang)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the KPI strip, hot leads, closing terbaru, and branch summary once leads/closings/branches fetches succeed", async () => {
    mockFetchOk();
    render(<DashboardClient />);

    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Hot Leads")).toBeInTheDocument();
    expect(screen.getByText("Xpander Cross AT 2019")).toBeInTheDocument();
    expect(screen.getByTestId("branch-summary")).toBeInTheDocument();
    expect(screen.getByText("Cinere")).toBeInTheDocument();
    // salesHumanId "sales-1" resolved to its real name via GET /api/branches's team roster.
    expect(screen.getByText(/Ahmad Fauzi/)).toBeInTheDocument();
  });

  it("renders <CalendarWidget /> after <BranchSummary /> (paling bawah)", async () => {
    mockFetchOk();
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByTestId("calendar-widget")).toBeInTheDocument());

    const branchSummary = screen.getByTestId("branch-summary");
    const calendarWidget = screen.getByTestId("calendar-widget");
    // eslint-disable-next-line no-bitwise -- DOCUMENT_POSITION_FOLLOWING bitmask, the standard way to assert DOM order.
    expect(
      branchSummary.compareDocumentPosition(calendarWidget) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("never calls /api/campaigns (Meta Ads data) — the Overview page only reads Supabase-backed leads/closings/branches data plus the localStorage Meta cache", async () => {
    mockFetchOk();
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledCampaigns = fetchMock.mock.calls.some((args: readonly unknown[]) =>
      String(args[0]).includes("/api/campaigns"),
    );
    expect(calledCampaigns).toBe(false);
  });

  it("shows an error card when a fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("omits Belanja Iklan and shows a 'belum ada data' digest when there is no cached Meta pull yet", async () => {
    mockFetchOk();
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    expect(screen.queryByText("Belanja Iklan")).not.toBeInTheDocument();
    expect(screen.getByText(/Belum ada data iklan tersimpan/)).toBeInTheDocument();
  });

  it("shows Belanja Iklan and PAUSE/SCALE/FIX tags from the cached Meta pull (localStorage), never fetching it", async () => {
    localStorage.setItem(
      CAMPAIGNS_CACHE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        period: "last_30d",
        data: {
          id: "act-1",
          name: "DSS Motor",
          syncedAt: new Date().toISOString(),
          campaigns: [],
          ads: [
            {
              id: "ad-1",
              stableId: "#C001",
              name: "Ad 1",
              campaignName: "Campaign 1",
              status: "ACTIVE",
              funnel: "DM",
              branch: "CINERE",
              verdict: "PAUSE",
              metrics: {
                spend: 500_000,
                clicks: 10,
                frequency: 1,
                conversations: 2,
                d2: 1,
                d3: 0,
                d5: 0,
                leadForm: 0,
                totalLead: 0,
                rphD3: null,
                rphLead: null,
              },
            },
          ],
          totals: {
            spend: 500_000,
            clicks: 10,
            frequency: 1,
            conversations: 2,
            d2: 1,
            d3: 0,
            d5: 0,
            leadForm: 0,
            totalLead: 0,
            rphD3: null,
            rphLead: null,
          },
          campaignCount: 1,
          adCount: 1,
        },
      }),
    );
    mockFetchOk();
    render(<DashboardClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());

    expect(screen.getByText("Belanja Iklan")).toBeInTheDocument();
    expect(screen.getByText(/1 perlu PAUSE/)).toBeInTheDocument();
  });
});
