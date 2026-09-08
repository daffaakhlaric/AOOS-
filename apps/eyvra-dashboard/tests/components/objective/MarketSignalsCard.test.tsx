import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketSignalsCard } from "@/components/objective/MarketSignalsCard";

function mockFetch(routes: Record<string, unknown>): void {
  global.fetch = vi.fn(async (url: string) => {
    const body = routes[url];
    if (body === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("MarketSignalsCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every real available signal with its own source tag", async () => {
    mockFetch({
      "/api/market-signals/latest": {
        signals: {
          id: "mkt-1",
          vertical: "PROPERTY",
          searchTrend: {
            available: true,
            keywords: [
              { keyword: "rumah dijual BSD", delta: "+24%", deltaPct: 24, trend: "RISING" },
            ],
            reasoning: "1 dari 1 keyword naik.",
          },
          competitorAngleTrend: {
            available: true,
            angleCounts: { KPR_RINGAN: 8, HUNIAN: 3 },
            activeAdCount: 11,
            topAngle: "KPR_RINGAN",
            reasoning: "x",
          },
          kprRate: {
            available: true,
            currentPct: 6.25,
            direction: "TURUN",
            asOf: "2026-09-01",
            reasoning: "x",
          },
          seasonality: {
            available: true,
            status: "musim ramai",
            note: "Mendekati THR — biasanya DP_RINGAN performa lebih baik.",
          },
          digestText: "digest",
          generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      },
    });
    render(<MarketSignalsCard />);

    await waitFor(() =>
      expect(screen.getByTestId("market-signals-card")).toHaveTextContent("rumah dijual BSD"),
    );
    expect(screen.getByTestId("market-signals-card")).toHaveTextContent("KPR_RINGAN");
    expect(screen.getByTestId("market-signals-card")).toHaveTextContent("6.25%");
    expect(screen.getByTestId("market-signals-card")).toHaveTextContent("Mendekati THR");
    expect(screen.getByTestId("market-signals-updated-at")).toHaveTextContent("3 hari lalu");
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Kompetitor")).toBeInTheDocument();
    expect(screen.getByText("KPR Rate")).toBeInTheDocument();
    expect(screen.getByText("Musiman")).toBeInTheDocument();
  });

  it("honestly shows each degraded source's real reason instead of fabricating data", async () => {
    mockFetch({
      "/api/market-signals/latest": {
        signals: {
          id: "mkt-1",
          vertical: "PROPERTY",
          searchTrend: { available: false, reason: "Google Trends circuit breaker terbuka." },
          competitorAngleTrend: { available: false, reason: "META_APP_ID belum dikonfigurasi." },
          kprRate: { available: false, reason: "MARKET_INTEL_KPR_RATE_PCT belum dikonfigurasi." },
          seasonality: { available: true, status: "musim sepi", note: "Musim sepi properti." },
          digestText: "digest",
          generatedAt: new Date().toISOString(),
        },
      },
    });
    render(<MarketSignalsCard />);

    await waitFor(() =>
      expect(screen.getByTestId("market-signals-card")).toHaveTextContent(
        "Google Trends circuit breaker terbuka.",
      ),
    );
    expect(screen.getByTestId("market-signals-card")).toHaveTextContent(
      "META_APP_ID belum dikonfigurasi.",
    );
    expect(screen.getByTestId("market-signals-card")).toHaveTextContent(
      "MARKET_INTEL_KPR_RATE_PCT belum dikonfigurasi.",
    );
  });

  it("shows an honest empty state when no Market Intelligence run has ever completed", async () => {
    mockFetch({ "/api/market-signals/latest": { signals: null } });
    render(<MarketSignalsCard />);

    await waitFor(() =>
      expect(screen.getByText(/Belum ada data sinyal pasar/)).toBeInTheDocument(),
    );
  });
});
