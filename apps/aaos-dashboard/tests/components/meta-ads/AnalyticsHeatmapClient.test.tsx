import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyticsHeatmapClient } from "@/components/meta-ads/AnalyticsHeatmapClient";
import type { HeatmapResponseDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const HEATMAP: HeatmapResponseDto = {
  adAccountId: "act_752604553578354",
  generatedAt: "2026-08-31T00:00:00.000Z",
  cells: [
    {
      assetKind: "IMAGE",
      assetId: "hash-A",
      audienceLabel: "BROAD",
      adCount: 2,
      spend: 500_000,
      impressions: 10_000,
      clicks: 200,
      totalLead: 10,
      maxFrequency: 1.5,
      ctr: 0.02,
      cpm: 50_000,
      cpl: 50_000,
    },
  ],
  creativeAssetIds: ["hash-A"],
  audienceLabels: ["BROAD"],
  untaggedAdCount: 0,
  benchmarkCplIDR: 40_000,
  insightText: "Kombinasi kreatif hash-A × audiens BROAD memiliki CPL terendah.",
};

describe("AnalyticsHeatmapClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading spinner, then renders the heatmap grid on a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(HEATMAP)) as unknown as typeof fetch);

    render(<AnalyticsHeatmapClient />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("heatmap-grid")).toBeInTheDocument();
    });
    expect(screen.getByTestId("heatmap-insight")).toHaveTextContent(
      "Kombinasi kreatif hash-A × audiens BROAD memiliki CPL terendah.",
    );
  });

  it("renders an ErrorCard when the fetch responds non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { message: "boom" } }, 500),
      ) as unknown as typeof fetch,
    );

    render(<AnalyticsHeatmapClient />);

    await waitFor(() => {
      expect(screen.getByTestId("error-card")).toBeInTheDocument();
    });
  });
});
