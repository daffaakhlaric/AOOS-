import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetaAdsClient } from "@/components/meta-ads/MetaAdsClient";
import { CAMPAIGNS_CACHE_KEY, writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const CAMPAIGNS_BODY: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [
    {
      id: "c1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 6_000_000,
      adSets: [
        {
          id: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 6_000_000,
          ads: [
            {
              id: "ad-1",
              stableId: "#C001",
              name: "Ad 1",
              status: "ACTIVE",
              funnel: "DM",
              branch: "BINTARO",
              verdict: "REVIEW",
              metrics: {
                spend: 6_000_000,
                clicks: 1200,
                frequency: 2.1,
                conversations: 790,
                d2: 400,
                d3: 307,
                d5: 100,
                leadForm: 20,
                totalLead: 320,
                rphD3: 19_541,
              },
            },
          ],
        },
      ],
    },
  ],
  ads: [
    {
      id: "ad-1",
      stableId: "#C001",
      name: "Ad 1",
      campaignName: "Meta-DM-Leads-Mobix",
      status: "ACTIVE",
      funnel: "DM",
      branch: "BINTARO",
      verdict: "REVIEW",
      metrics: {
        spend: 6_000_000,
        clicks: 1200,
        frequency: 2.1,
        conversations: 790,
        d2: 400,
        d3: 307,
        d5: 100,
        leadForm: 20,
        totalLead: 320,
        rphD3: 19_541,
      },
    },
  ],
  totals: {
    spend: 6_000_000,
    clicks: 1200,
    frequency: 0,
    conversations: 790,
    d2: 400,
    d3: 307,
    d5: 100,
    leadForm: 20,
    totalLead: 320,
    rphD3: null,
  },
  campaignCount: 1,
  adCount: 1,
};

describe("MetaAdsClient (MAAO2 redesign: localStorage cache, always-force-refresh Tarik Data, rate-limit-keeps-cache banner)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT fetch on mount when there is no cache — shows the empty state", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows cached data on mount from localStorage, with no network call at all", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const fetchMock = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MetaAdsClient />);

    expect(await screen.findByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows stale (>60 min old) cached data on mount too — never blanks to empty/loading when a cache exists", async () => {
    const staleFetchedAt = Date.now() - 61 * 60_000;
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: staleFetchedAt, period: "last_30d" });
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;

    render(<MetaAdsClient />);

    expect(await screen.findByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument();
    expect(screen.getByTestId("last-updated").textContent).toContain("lebih dari 60 menit lalu");
  });

  it("fetches and renders the campaign tree + summary bar after 'Tarik Data Baru' is clicked", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());
    expect(screen.getByTestId("metrics-summary-bar")).toBeInTheDocument();
    expect(screen.getByText("Kampanye")).toBeInTheDocument();
  });

  it("always passes refresh=1 on 'Tarik Data Baru' — a click always forces a genuinely fresh pull, even right after a previous successful one", async () => {
    const fetchMock = vi.fn(async (_input: string) => jsonResponse(CAMPAIGNS_BODY));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toContain("refresh=1");
    }
  });

  it("persists a successful pull to localStorage so it survives a remount (simulating a page reload)", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    const { unmount } = render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());
    unmount();

    expect(localStorage.getItem(CAMPAIGNS_CACHE_KEY)).not.toBeNull();

    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    expect(await screen.findByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the 'Riwayat tarikan' history dropdown after a second successful pull, and switching to a history entry displays its data", async () => {
    const secondBody: AdAccountSummaryDto = {
      ...CAMPAIGNS_BODY,
      campaigns: [{ ...CAMPAIGNS_BODY.campaigns[0]!, name: "Second Pull Campaign" }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(CAMPAIGNS_BODY))
      .mockResolvedValueOnce(jsonResponse(secondBody));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Second Pull Campaign/)).toBeInTheDocument());

    const historyToggle = screen.getByText(/Riwayat tarikan/);
    await userEvent.click(historyToggle);
    const historyEntries = screen
      .getAllByRole("button")
      .filter((btn) => (btn.textContent ?? "").includes("hari terakhir"));
    expect(historyEntries.length).toBeGreaterThan(0);
    await userEvent.click(historyEntries[0]!);
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());
  });

  it("shows a blocking rate-limit message (429/503) when there is no cached data yet", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByTestId("error-card").textContent).toContain(
      "Meta API sedang sibuk. Tunggu beberapa menit lalu coba lagi.",
    );
  });

  it("keeps showing cached data with an orange banner (not a blank/error state) when a refresh hits 429/503 while cache exists", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    expect(await screen.findByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByTestId("rate-limit-banner")).toBeInTheDocument());
    expect(screen.getByTestId("rate-limit-banner").textContent).toContain(
      "Data terakhir ditampilkan dari cache",
    );
    // The cached data is still on screen — not replaced by an empty/error state.
    expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument();
    expect(screen.queryByTestId("error-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("filters the tree via the search input", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());

    await userEvent.type(screen.getByLabelText("Cari campaign"), "nonexistent-xyz");
    await waitFor(() => expect(screen.getByText("Tidak ada hasil")).toBeInTheDocument());
  });

  it("posts to /api/verdicts and force-refetches when a tree Execute button is clicked", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (String(input).includes("/api/verdicts")) return jsonResponse({ action: "PAUSED" });
      return jsonResponse(CAMPAIGNS_BODY);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());

    const executeButtons = screen.getAllByRole("button", { name: /Execute/ });
    await userEvent.click(executeButtons[0]!);
    await waitFor(() => {
      const calledVerdicts = fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/verdicts"),
      );
      expect(calledVerdicts).toBe(true);
    });
    await waitFor(() => {
      const refetchedFresh = fetchMock.mock.calls.some(
        ([url]) => String(url).includes("/api/campaigns") && String(url).includes("refresh=1"),
      );
      expect(refetchedFresh).toBe(true);
    });
  });

  it("does not get stuck on the loading spinner under React StrictMode (real bug fix — see MetaAdsClient.tsx's mountedRef docstring)", async () => {
    global.fetch = vi.fn(async () => jsonResponse(CAMPAIGNS_BODY)) as unknown as typeof fetch;
    render(<MetaAdsClient />, { wrapper: StrictMode });

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByText(/#A001 Meta-DM-Leads-Mobix/)).toBeInTheDocument());
    expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
  });
});
