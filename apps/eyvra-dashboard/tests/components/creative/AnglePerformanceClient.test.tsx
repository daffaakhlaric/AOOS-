import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnglePerformanceClient } from "@/components/creative/AnglePerformanceClient";

function mockFetch(
  routes: Record<string, { readonly body: unknown; readonly status?: number }>,
): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matchKey = Object.keys(routes).find((key) => url === key || url.startsWith(key));
    if (matchKey === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    const route = routes[matchKey];
    if (route === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as unknown as typeof fetch;
}

const ROUTE = "/api/creative-memory/angle-performance";

const EMPTY_RESPONSE = { angles: [] };

const RANKED_WINNER = {
  angle: "DP_RINGAN",
  packageCount: 4,
  aggregated: {
    spend: 4_500_000,
    impressions: 25_000,
    clicks: 500,
    reach: 20_000,
    leads: 45,
    ctr: 0.02,
    cpm: 180,
    cpc: 9_000,
    cpl: 100_000,
    frequency: 1.25,
  },
  dataSufficiency: { level: "HIGH", score: 92, reasons: [] },
  rank: 1,
};

const RANKED_SECOND = {
  angle: "READY_HUNI",
  packageCount: 3,
  aggregated: {
    spend: 3_000_000,
    impressions: 22_000,
    clicks: 400,
    reach: 18_000,
    leads: 20,
    ctr: 0.018,
    cpm: 136,
    cpc: 7_500,
    cpl: 150_000,
    frequency: 1.22,
  },
  dataSufficiency: {
    level: "MEDIUM",
    score: 60,
    reasons: ["Leads 20 di bawah 30 untuk tingkat keyakinan tinggi."],
  },
  rank: 2,
};

const UNRANKED_LOW = {
  angle: "INVESTASI",
  packageCount: 1,
  aggregated: {
    spend: 200_000,
    impressions: 800,
    clicks: 10,
    reach: 700,
    leads: 0,
    ctr: 0.0125,
    cpm: 250,
    cpc: 20_000,
    cpl: undefined,
    frequency: 1.14,
  },
  dataSufficiency: {
    level: "INSUFFICIENT",
    score: 15,
    reasons: [
      "Impressions baru 800 — di bawah ambang minimum 1000 untuk statistik yang bisa diandalkan.",
    ],
  },
  rank: undefined,
};

const POPULATED_RESPONSE = {
  angles: [RANKED_WINNER, RANKED_SECOND, UNRANKED_LOW],
};

describe("AnglePerformanceClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real angle-performance fetch resolves", () => {
    mockFetch({ [ROUTE]: { body: EMPTY_RESPONSE } });
    render(<AnglePerformanceClient />);
    expect(screen.getByTestId("angle-performance-card")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("angle-performance-row")).not.toBeInTheDocument();
  });

  it("error state: shows an honest error message when the fetch fails", async () => {
    mockFetch({ [ROUTE]: { body: { error: { message: "boom" } }, status: 500 } });
    render(<AnglePerformanceClient />);
    await waitFor(() =>
      expect(screen.getByText("Gagal memuat Angle Performance.")).toBeInTheDocument(),
    );
  });

  it("empty state: renders an honest 'belum ada data' message when angles is an empty array", async () => {
    mockFetch({ [ROUTE]: { body: EMPTY_RESPONSE } });
    render(<AnglePerformanceClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(
      screen.getByText("Belum ada data performa angle — publish beberapa campaign dulu."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("angle-performance-row")).not.toBeInTheDocument();
  });

  it("populated state: renders ranked and unranked angles with correct rank badges, metrics, and honest fallbacks", async () => {
    mockFetch({ [ROUTE]: { body: POPULATED_RESPONSE } });
    render(<AnglePerformanceClient />);
    await waitFor(() => expect(screen.getAllByTestId("angle-performance-row")).toHaveLength(3));

    const angleNames = screen.getAllByTestId("angle-name");
    expect(angleNames[0]).toHaveTextContent("DP_RINGAN");
    expect(angleNames[1]).toHaveTextContent("READY_HUNI");
    expect(angleNames[2]).toHaveTextContent("INVESTASI");

    // Rank-1 gets a distinct "winner" badge.
    const rankBadges = screen.getAllByTestId("angle-rank-badge");
    expect(rankBadges).toHaveLength(2);
    expect(rankBadges[0]).toHaveTextContent("#1");
    expect(rankBadges[1]).toHaveTextContent("#2");

    const rows = screen.getAllByTestId("angle-performance-row");
    expect(rows[0]?.className).toContain("rowWinner");
    expect(rows[1]?.className).not.toContain("rowWinner");

    // Unranked angle shows the honest "belum cukup data" note, no rank badge.
    expect(screen.getByTestId("angle-unranked-note")).toHaveTextContent(
      "Belum cukup data untuk diranking",
    );

    // Zero-lead angle's CPL shows the honest fallback, never a fabricated number.
    const cplValues = screen.getAllByTestId("angle-cpl");
    expect(cplValues[2]).toHaveTextContent("Belum ada lead");
    expect(cplValues[0]).toHaveTextContent("Rp");

    // packageCount + dataSufficiency badge rendered.
    expect(screen.getAllByTestId("angle-package-count")[0]).toHaveTextContent("4 creative package");
    expect(screen.getAllByTestId("data-sufficiency-badge")[0]).toHaveTextContent("Data Tinggi");
  });
});
