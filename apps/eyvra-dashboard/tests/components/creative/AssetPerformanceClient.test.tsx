import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetPerformanceClient } from "@/components/creative/AssetPerformanceClient";

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

const ROUTE = "/api/creative-memory/asset-performance";

const EMPTY_RESPONSE = { assets: [] };

const RANKED_WINNER = {
  packageId: "pkg-winner-1",
  angle: "DP_RINGAN",
  title: "Video DP Ringan — Cicilan 1 Jutaan",
  decidedFormat: "VIDEO_AND_IMAGES",
  fatigueStatus: "NORMAL",
  hasVideo: true,
  imageCount: 3,
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
  packageId: "pkg-second-2",
  angle: "READY_HUNI",
  title: "Gambar Ready Huni — Siap Ditempati",
  decidedFormat: "IMAGES_ONLY",
  fatigueStatus: "WARNING",
  hasVideo: false,
  imageCount: 5,
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
  packageId: "pkg-unranked-3",
  angle: "INVESTASI",
  title: "Copy Investasi — Belum Cukup Data",
  fatigueStatus: "FATIGUED",
  hasVideo: false,
  imageCount: 1,
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
  assets: [RANKED_WINNER, RANKED_SECOND, UNRANKED_LOW],
};

describe("AssetPerformanceClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loading state: shows a spinner before the real asset-performance fetch resolves", () => {
    mockFetch({ [ROUTE]: { body: EMPTY_RESPONSE } });
    render(<AssetPerformanceClient />);
    expect(screen.getByTestId("asset-performance-card")).toBeInTheDocument();
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("asset-performance-row")).not.toBeInTheDocument();
  });

  it("error state: shows an honest error message when the fetch fails", async () => {
    mockFetch({ [ROUTE]: { body: { error: { message: "boom" } }, status: 500 } });
    render(<AssetPerformanceClient />);
    await waitFor(() =>
      expect(screen.getByText("Gagal memuat Asset Performance.")).toBeInTheDocument(),
    );
  });

  it("empty state: renders an honest 'belum ada data' message when assets is an empty array", async () => {
    mockFetch({ [ROUTE]: { body: EMPTY_RESPONSE } });
    render(<AssetPerformanceClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(
      screen.getByText("Belum ada data performa asset — publish beberapa creative package dulu."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("asset-performance-row")).not.toBeInTheDocument();
  });

  it("populated state: renders ranked and unranked assets with correct rank badges, format badges, metrics, and honest fallbacks", async () => {
    mockFetch({ [ROUTE]: { body: POPULATED_RESPONSE } });
    render(<AssetPerformanceClient />);
    await waitFor(() => expect(screen.getAllByTestId("asset-performance-row")).toHaveLength(3));

    const titles = screen.getAllByTestId("asset-title");
    expect(titles[0]).toHaveTextContent("Video DP Ringan — Cicilan 1 Jutaan");
    expect(titles[1]).toHaveTextContent("Gambar Ready Huni — Siap Ditempati");
    expect(titles[2]).toHaveTextContent("Copy Investasi — Belum Cukup Data");

    const angles = screen.getAllByTestId("asset-angle");
    expect(angles[0]).toHaveTextContent("DP_RINGAN");

    // Rank-1 gets a distinct "winner" badge.
    const rankBadges = screen.getAllByTestId("asset-rank-badge");
    expect(rankBadges).toHaveLength(2);
    expect(rankBadges[0]).toHaveTextContent("#1");
    expect(rankBadges[1]).toHaveTextContent("#2");

    const rows = screen.getAllByTestId("asset-performance-row");
    expect(rows[0]?.className).toContain("rowWinner");
    expect(rows[1]?.className).not.toContain("rowWinner");

    // Format badges reflect the asset's own real hasVideo/imageCount, not fabricated.
    const formatBadges = screen.getAllByTestId("asset-format-badge");
    expect(formatBadges[0]).toHaveTextContent("Video + Gambar");
    expect(formatBadges[1]).toHaveTextContent("Gambar Saja");
    const imageCounts = screen.getAllByTestId("asset-image-count");
    expect(imageCounts[0]).toHaveTextContent("3 gambar");
    expect(imageCounts[1]).toHaveTextContent("5 gambar");

    // Fatigue badge only appears for non-NORMAL fatigueStatus.
    const fatigueBadges = screen.getAllByTestId("asset-fatigue-badge");
    expect(fatigueBadges).toHaveLength(2);
    expect(fatigueBadges[0]).toHaveTextContent("Menurun");
    expect(fatigueBadges[1]).toHaveTextContent("⚠ Fatigue");

    // Unranked asset shows the honest "belum cukup data" note, no rank badge.
    expect(screen.getByTestId("asset-unranked-note")).toHaveTextContent(
      "Belum cukup data untuk diranking",
    );

    // Zero-lead asset's CPL shows the honest fallback, never a fabricated number.
    const cplValues = screen.getAllByTestId("asset-cpl");
    expect(cplValues[2]).toHaveTextContent("Belum ada lead");
    expect(cplValues[0]).toHaveTextContent("Rp");

    // packageId + dataSufficiency badge rendered.
    expect(screen.getAllByTestId("asset-package-id")[0]).toHaveTextContent("pkg-winner-1");
    expect(screen.getAllByTestId("data-sufficiency-badge")[0]).toHaveTextContent("Data Tinggi");
  });
});
