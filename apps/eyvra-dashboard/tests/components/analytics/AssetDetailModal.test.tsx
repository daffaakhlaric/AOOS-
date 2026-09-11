import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDetailModal } from "@/components/analytics/AssetDetailModal";
import type { AssetDetailResponseDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const DETAIL: AssetDetailResponseDto = {
  adAccountId: "act_1",
  generatedAt: "2026-08-31T00:00:00.000Z",
  assetKind: "IMAGE",
  assetId: "hash-A",
  adCount: 2,
  spend: 1_000_000,
  impressions: 20_000,
  clicks: 400,
  totalLead: 20,
  maxFrequency: 2.1,
  rphLead: 50_000,
  copyVariants: [
    {
      adId: "ad1",
      stableId: "#C001",
      name: "Xpander Creative 1",
      branch: "BINTARO",
      audienceLabel: "BROAD",
      spend: 600_000,
      impressions: 12_000,
      clicks: 240,
      totalLead: 12,
      frequency: 2.0,
      cpl: 50_000,
    },
    {
      adId: "ad2",
      stableId: "#C002",
      name: "Xpander Creative 2",
      branch: "BINTARO",
      audienceLabel: "BROAD",
      spend: 400_000,
      impressions: 8_000,
      clicks: 160,
      totalLead: 8,
      frequency: 2.1,
      cpl: 50_000,
    },
  ],
  audienceBreakdown: [
    {
      audienceLabel: "BROAD",
      adCount: 2,
      spend: 1_000_000,
      impressions: 20_000,
      clicks: 400,
      totalLead: 20,
      maxFrequency: 2.1,
      cpl: 50_000,
    },
  ],
  topAudienceLabel: "BROAD",
  insight: {
    available: true,
    kaiTake: "Kai's real take on this asset.",
    samanthaVerdict: "Samantha's real media-buying verdict on this asset.",
  },
};

describe("AssetDetailModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches /api/analytics/assets/:id and renders real MetricCard + CopyVariantList components (shared with CampaignDetailDrawer)", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(DETAIL));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<AssetDetailModal assetId="hash-A" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("metric-card").length).toBeGreaterThanOrEqual(6);
    });
    expect(screen.getByTestId("copy-variant-list")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/analytics/assets/hash-A");
  });

  it("shows the real Kai + Samantha insight panels when available (gap 3 — two-persona split)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)) as unknown as typeof fetch);
    render(<AssetDetailModal assetId="hash-A" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-insight-kai")).toHaveTextContent(
        "Kai's real take on this asset.",
      );
    });
    expect(screen.getByTestId("asset-detail-insight-samantha")).toHaveTextContent(
      "Samantha's real media-buying verdict on this asset.",
    );
  });

  it("renders the real Audience Breakdown table from the already-fetched payload (gap 2)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)) as unknown as typeof fetch);
    render(<AssetDetailModal assetId="hash-A" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("audience-breakdown-table")).toBeInTheDocument();
    });
    expect(screen.getAllByTestId("audience-breakdown-row")).toHaveLength(1);
  });

  it("renders a Launch New Ad link to the real, existing Creative Hub entry point (gap 4)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)) as unknown as typeof fetch);
    render(<AssetDetailModal assetId="hash-A" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("launch-new-ad-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("launch-new-ad-button")).toHaveAttribute(
      "href",
      "/creative?tab=review-kai",
    );
  });

  it("honestly shows the unavailable message when the real LLM insight failed, never fabricating a summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...DETAIL,
          insight: {
            available: false,
            reason: "LLM_UNAVAILABLE",
            message: "Insight tidak tersedia.",
          },
        }),
      ) as unknown as typeof fetch,
    );
    render(<AssetDetailModal assetId="hash-A" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail-insight-unavailable")).toHaveTextContent(
        "Insight tidak tersedia.",
      );
    });
  });

  it("calls onClose when the close button is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)) as unknown as typeof fetch);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AssetDetailModal assetId="hash-A" onClose={onClose} />);
    await waitFor(() => expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Tutup" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
