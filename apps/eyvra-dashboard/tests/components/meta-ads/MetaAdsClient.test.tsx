import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MetaAdsClient } from "@/components/meta-ads/MetaAdsClient";
import { CAMPAIGNS_CACHE_KEY, writeCampaignsCache } from "@/lib/campaignsCache";
import type { AdAccountSummaryDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/**
 * Every test below now also mounts `CabangSourceClient` (embedded at the top of
 * `MetaAdsClient.tsx` — user feedback: "itu data ada di halaman data iklan jadi di paling atas"),
 * which unconditionally fetches `GET /api/meta-ads-accounts` once on mount — a real, deliberate,
 * documented exception to this app's "never auto-call Meta on mount" rule (see
 * `CabangSourceClient.tsx`'s `useAdAccounts` docstring: it's a cheap `fields=name` metadata call,
 * not the heavy Insights pull `/api/campaigns` triggers). Wraps a test's own `/api/campaigns`/
 * `/api/verdicts` handler so every test doesn't need to special-case this extra endpoint itself;
 * responds with an empty account list so `CabangSourceClient`'s pill selector never renders and
 * doesn't interfere with any test's own DOM assertions.
 */
function withAccountsEndpoint(
  handler: (input: string | URL, init?: RequestInit) => Promise<Response>,
): (input: string | URL, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    if (String(input).includes("/api/meta-ads-accounts")) {
      return jsonResponse([]);
    }
    return handler(input, init);
  };
}

/** Filters a fetch mock's calls down to just the ones that hit `/api/campaigns` — the endpoint
 * these tests actually care about — so `CabangSourceClient`'s own `/api/meta-ads-accounts` call
 * doesn't affect call-count/URL assertions meant for `MetaAdsClient`'s own pulls. */
function campaignsCalls(fetchMock: { mock: { calls: unknown[][] } }): readonly string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes("/api/campaigns"));
}

/** Scopes a query to the `CampaignTree` region specifically — `CabangSourceClient`'s own "Top
 * Campaign" table (embedded above the tree on this same page) legitimately shows the SAME real
 * campaign name again as a row, so an unscoped `screen.getByText(campaignName)` now matches twice. */
function campaignTree(): ReturnType<typeof within> {
  return within(screen.getByTestId("campaign-tree"));
}

const CAMPAIGNS_BODY: AdAccountSummaryDto = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [
    {
      id: "c1",
      metaId: "c1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 6_000_000,
      adSets: [
        {
          id: "as1",
          metaId: "as1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 6_000_000,
          dailyBudget: 3_000_000,
          ads: [
            {
              id: "ad-1",
              metaId: "ad-1",
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
                rphLead: 18_750,
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
      metaId: "ad-1",
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
        rphLead: 18_750,
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
    rphLead: null,
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

  it("does NOT fetch /api/campaigns on mount when there is no cache — shows the empty state", async () => {
    const fetchMock = vi.fn(withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(campaignsCalls(fetchMock)).toHaveLength(0);
  });

  it("shows cached data on mount from localStorage, with no /api/campaigns network call at all", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    const fetchMock = vi.fn(withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MetaAdsClient />);

    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    expect(campaignsCalls(fetchMock)).toHaveLength(0);
  });

  it("shows stale (>60 min old) cached data on mount too — never blanks to empty/loading when a cache exists", async () => {
    const staleFetchedAt = Date.now() - 61 * 60_000;
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: staleFetchedAt, period: "last_30d" });
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)),
    ) as unknown as typeof fetch;

    render(<MetaAdsClient />);

    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("last-updated").textContent).toContain("lebih dari 60 menit lalu");
  });

  it("fetches and renders the campaign tree + summary bar after 'Tarik Data Baru' is clicked", async () => {
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)),
    ) as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("metrics-summary-bar")).toBeInTheDocument();
    expect(screen.getByText("Kampanye")).toBeInTheDocument();
  });

  it("always passes refresh=1 on 'Tarik Data Baru' — a click always forces a genuinely fresh pull, even right after a previous successful one", async () => {
    const fetchMock = vi.fn(withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(campaignsCalls(fetchMock)).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(campaignsCalls(fetchMock)).toHaveLength(2));
    for (const url of campaignsCalls(fetchMock)) {
      expect(url).toContain("refresh=1");
    }
  });

  it("persists a successful pull to localStorage so it survives a remount (simulating a page reload)", async () => {
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)),
    ) as unknown as typeof fetch;
    const { unmount } = render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    unmount();

    expect(localStorage.getItem(CAMPAIGNS_CACHE_KEY)).not.toBeNull();

    const fetchMock = vi.fn(withAccountsEndpoint(async () => jsonResponse({}, 500)));
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    expect(campaignsCalls(fetchMock)).toHaveLength(0);
  });

  it("shows the snapshot selector (closed-state label = current snapshot's timestamp, per spec) after a second successful pull, and switching to a history entry displays its data", async () => {
    const secondBody: AdAccountSummaryDto = {
      ...CAMPAIGNS_BODY,
      campaigns: [{ ...CAMPAIGNS_BODY.campaigns[0]!, name: "Second Pull Campaign" }],
    };
    // Sequenced by /api/campaigns call number specifically (not raw call order) — `CabangSourceClient`'s
    // own `/api/meta-ads-accounts` mount fetch would otherwise jump this queue and desync which
    // response each "Tarik Data Baru" click actually receives.
    let campaignsCallCount = 0;
    const fetchMock = vi.fn(
      withAccountsEndpoint(async () => {
        campaignsCallCount += 1;
        return jsonResponse(campaignsCallCount === 1 ? CAMPAIGNS_BODY : secondBody);
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Second Pull Campaign")).toBeInTheDocument(),
    );

    const historyToggle = screen.getByTestId("snapshot-selector");
    await userEvent.click(historyToggle);
    const historyEntries = screen
      .getAllByRole("button")
      .filter((btn) => (btn.textContent ?? "").includes("hari terakhir"));
    expect(historyEntries.length).toBeGreaterThan(0);
    await userEvent.click(historyEntries[0]!);
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
  });

  it("shows a blocking rate-limit message (429/503) when there is no cached data yet", async () => {
    // Only `/api/campaigns` returns 429 here — `CabangSourceClient`'s own `/api/meta-ads-accounts`
    // call must succeed (empty list), or it would render its OWN error-card and break this test's
    // "exactly one error-card" assumption with an unrelated failure.
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse({}, 429)),
    ) as unknown as typeof fetch;
    render(<MetaAdsClient />);

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByTestId("error-card").textContent).toContain(
      "Meta API sedang sibuk. Tunggu beberapa menit lalu coba lagi.",
    );
  });

  it("keeps showing cached data with an orange banner (not a blank/error state) when a refresh hits 429/503 while cache exists", async () => {
    writeCampaignsCache({ data: CAMPAIGNS_BODY, fetchedAt: Date.now(), period: "last_30d" });
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse({}, 503)),
    ) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() => expect(screen.getByTestId("rate-limit-banner")).toBeInTheDocument());
    expect(screen.getByTestId("rate-limit-banner").textContent).toContain(
      "Data terakhir ditampilkan dari cache",
    );
    // The cached data is still on screen — not replaced by an empty/error state. Checked by the
    // page's own specific "no data yet" title text, not the generic `empty-state` testid — the
    // embedded `CabangSourceClient`'s two deliberate "Belum tersedia" (Per Source/Cabang × Source)
    // placeholders also carry that same testid and are expected to always be present.
    expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument();
    expect(screen.queryByTestId("error-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Belum ada data")).not.toBeInTheDocument();
  });

  it("filters the tree via the search input", async () => {
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)),
    ) as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText("Cari campaign"), "nonexistent-xyz");
    await waitFor(() => expect(screen.getByText("Tidak ada hasil")).toBeInTheDocument());
  });

  it("posts to /api/verdicts and force-refetches when a tree Execute button is clicked", async () => {
    const fetchMock = vi.fn(
      withAccountsEndpoint(async (input) => {
        if (String(input).includes("/api/verdicts")) return jsonResponse({ action: "PAUSED" });
        return jsonResponse(CAMPAIGNS_BODY);
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<MetaAdsClient />);
    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );

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
    global.fetch = vi.fn(
      withAccountsEndpoint(async () => jsonResponse(CAMPAIGNS_BODY)),
    ) as unknown as typeof fetch;
    render(<MetaAdsClient />, { wrapper: StrictMode });

    await userEvent.click(screen.getByRole("button", { name: /Tarik Data Baru/ }));
    await waitFor(() =>
      expect(campaignTree().getByText("Meta-DM-Leads-Mobix")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
  });
});
