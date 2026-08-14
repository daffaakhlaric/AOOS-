import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StrategiClient } from "@/components/meta-ads/StrategiClient";
import { writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

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
    ...overrides,
  };
}

function buildData(fetchedAt: number): AdAccountSummaryDto {
  return {
    id: "act_1",
    name: "Mobix Main",
    syncedAt: new Date(fetchedAt).toISOString(),
    campaigns: [],
    ads: [
      {
        id: "ad-pause",
        stableId: "#C001",
        name: "Ad To Pause",
        campaignName: "Campaign A",
        status: "ACTIVE",
        funnel: "DM",
        branch: "BINTARO",
        verdict: "PAUSE",
        metrics: metrics({ spend: 800_000, conversations: 5 }),
      },
      {
        id: "ad-scale",
        stableId: "#C002",
        name: "Ad To Scale",
        campaignName: "Campaign B",
        status: "ACTIVE",
        funnel: "DM",
        branch: "CINERE",
        verdict: "SCALE",
        metrics: metrics({ spend: 300_000, conversations: 30, totalLead: 40 }),
      },
      {
        id: "ad-keep",
        stableId: "#C003",
        name: "Ad Keep",
        campaignName: "Campaign C",
        status: "ACTIVE",
        funnel: "DM",
        branch: "UMUM",
        verdict: "KEEP",
        metrics: metrics({}),
      },
    ],
    totals: metrics({ spend: 1_100_000, conversations: 35, totalLead: 50 }),
    campaignCount: 3,
    adCount: 3,
  };
}

describe("StrategiClient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when there is no cache", async () => {
    render(<StrategiClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("lists only ads whose verdict is not KEEP, with the right proposed action", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    const list = await screen.findByTestId("strategi-list");
    expect(list.textContent).toContain("Ad To Pause");
    expect(list.textContent).toContain("🔴 Matikan");
    expect(list.textContent).toContain("Ad To Scale");
    expect(list.textContent).toContain("📈 Naikkan budget");
    expect(list.textContent).not.toContain("Ad Keep");
  });

  it("marks an item 'Disetujui ✅' after clicking Setujui, and persists the decision across remounts of the same snapshot", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    const { unmount } = render(<StrategiClient />);
    await screen.findByTestId("strategi-list");

    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    expect(await screen.findByTestId("approved-badge-ad-pause")).toBeInTheDocument();

    unmount();
    render(<StrategiClient />);
    expect(await screen.findByTestId("approved-badge-ad-pause")).toBeInTheDocument();
  });

  it("Tolak does not mark an item approved", async () => {
    const fetchedAt = Date.now();
    writeCampaignsCache({ data: buildData(fetchedAt), fetchedAt, period: "last_30d" });
    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");

    const rejectButtons = screen.getAllByRole("button", { name: /^Tolak$/ });
    await userEvent.click(rejectButtons[0]!);
    expect(screen.queryByTestId("approved-badge-ad-pause")).not.toBeInTheDocument();
  });

  it("Execute Semua yang Disetujui calls POST /api/verdicts once per approved ad (never a bulk array)", async () => {
    const fetchedAt = Date.now();
    const data = buildData(fetchedAt);
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit) => {
      if (String(input).includes("/api/verdicts")) return jsonResponse({ action: "PAUSED" });
      return jsonResponse(data);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");
    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    await userEvent.click(approveButtons[1]!);

    await userEvent.click(screen.getByRole("button", { name: /Execute Semua/ }));

    await waitFor(() => {
      const verdictCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes("/api/verdicts"),
      );
      expect(verdictCalls).toHaveLength(2);
    });
    for (const [, init] of fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/verdicts"),
    )) {
      const parsed: unknown = JSON.parse(String(init?.body));
      expect(Array.isArray(parsed)).toBe(false);
    }
  });

  it("handles partial failure: one item fails, one succeeds, and both are reported", async () => {
    const fetchedAt = Date.now();
    const data = buildData(fetchedAt);
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    let callCount = 0;
    global.fetch = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/verdicts")) {
        callCount += 1;
        return callCount === 1 ? jsonResponse({ action: "PAUSED" }) : jsonResponse({}, 500);
      }
      return jsonResponse(data);
    }) as unknown as typeof fetch;

    render(<StrategiClient />);
    await screen.findByTestId("strategi-list");
    const approveButtons = screen.getAllByRole("button", { name: /Setujui/ });
    await userEvent.click(approveButtons[0]!);
    await userEvent.click(approveButtons[1]!);

    await userEvent.click(screen.getByRole("button", { name: /Execute Semua/ }));

    await waitFor(() => expect(screen.getByTestId("execute-summary")).toBeInTheDocument());
    expect(screen.getByTestId("execute-summary").textContent).toContain("1/2 berhasil");
    expect(screen.getByTestId("execute-summary").textContent).toContain("1 gagal");
  });

  it("shows a KEEP-only empty state when no ad needs action", async () => {
    const fetchedAt = Date.now();
    const data = { ...buildData(fetchedAt), ads: [buildData(fetchedAt).ads[2]!] };
    writeCampaignsCache({ data, fetchedAt, period: "last_30d" });
    render(<StrategiClient />);

    expect(await screen.findByText(/Semua iklan sudah KEEP/)).toBeInTheDocument();
  });
});
