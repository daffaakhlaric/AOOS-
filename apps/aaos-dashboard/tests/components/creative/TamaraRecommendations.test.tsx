import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TamaraRecommendations } from "@/components/creative/TamaraRecommendations";
import { CAMPAIGNS_CACHE_KEY } from "@/lib/campaignsCache";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function ad(overrides: Record<string, unknown> = {}) {
  return {
    id: "120000000000001",
    stableId: "C047",
    name: "Brand-Boost-Xpander-Cinere",
    campaignName: "Boost",
    status: "ACTIVE",
    funnel: "MOFU",
    branch: "CINERE",
    verdict: "REFRESH",
    daysSinceCreation: 23,
    metrics: {
      spend: 1_000_000,
      clicks: 100,
      frequency: 4.8,
      conversations: 12,
      d2: 1,
      d3: 1,
      d5: 0,
      leadForm: 0,
      totalLead: 3,
      rphD3: null,
      rphLead: null,
    },
    ...overrides,
  };
}

function seedCache(ads: readonly unknown[]): void {
  window.localStorage.setItem(
    CAMPAIGNS_CACHE_KEY,
    JSON.stringify({
      data: {
        id: "act_1",
        name: "DSS",
        syncedAt: "2026-08-18T00:00:00.000Z",
        campaigns: [],
        ads,
        totals: {
          spend: 0,
          clicks: 0,
          frequency: 0,
          conversations: 0,
          d2: 0,
          d3: 0,
          d5: 0,
          leadForm: 0,
          totalLead: 0,
          rphD3: null,
          rphLead: null,
        },
        campaignCount: 0,
        adCount: ads.length,
      },
      fetchedAt: Date.now(),
      period: "last_30d",
    }),
  );
}

describe("TamaraRecommendations", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists exactly the ads whose REAL verdict is REFRESH — no client-side threshold math", async () => {
    seedCache([
      ad(),
      ad({
        id: "b",
        stableId: "C048",
        verdict: "KEEP",
        metrics: { ...ad().metrics, frequency: 9 },
      }),
      ad({ id: "c", stableId: "C049", verdict: "PAUSE" }),
    ]);
    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByTestId("tamara-recommendation")).toHaveLength(1));
    // The KEEP ad has frequency 9 — far above the spec's proposed 3.5 threshold — and is still
    // absent, proving the verdict field (not a re-derived threshold) is what drives this list.
    expect(screen.queryByText(/#C048/)).not.toBeInTheDocument();
    expect(screen.getByText(/#C047/)).toBeInTheDocument();
  });

  it("shows frequency/days as context only", async () => {
    seedCache([ad()]);
    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("tamara-recommendation")).toBeInTheDocument());
    expect(screen.getByText(/freq: 4,8/)).toBeInTheDocument();
    expect(screen.getByText(/23 hari berjalan/)).toBeInTheDocument();
  });

  it("empty-states when no ad carries a REFRESH verdict", async () => {
    seedCache([ad({ verdict: "SCALE" })]);
    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("prompts for a data pull when nothing has ever been fetched", async () => {
    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Tarik data iklan/ })).toBeInTheDocument();
  });

  it("approving sends origin TAMARA plus the ad's real ids, and only on click", async () => {
    seedCache([ad()]);
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ package: { id: "pkg-1", title: "T", status: "GENERATING" } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onCreated = vi.fn();

    render(<TamaraRecommendations onCreated={onCreated} />);
    await waitFor(() => expect(screen.getByTestId("tamara-recommendation")).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Setujui brief ini/ }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body["origin"]).toBe("TAMARA");
    expect(body["adId"]).toBe("120000000000001");
    expect(body["stableId"]).toBe("C047");
    expect(body["generate"]).toBe(true);
    expect(String(body["reason"])).toContain("REFRESH");
  });

  it("“Simpan sebagai draft dulu” creates the brief WITHOUT generating", async () => {
    seedCache([ad()]);
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ package: { id: "pkg-1", title: "T", status: "DRAFT" } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("tamara-recommendation")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai draft dulu/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body["generate"]).toBe(false);
  });

  it("surfaces an upstream failure instead of pretending the brief was created", async () => {
    seedCache([ad()]);
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "unit must be a non-empty string" } }, 422),
    ) as unknown as typeof fetch;

    render(<TamaraRecommendations onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("tamara-recommendation")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Setujui brief ini/ }));
    await waitFor(() =>
      expect(screen.getByTestId("error-card")).toHaveTextContent(/non-empty string/),
    );
  });
});
