import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AssetDetailClient } from "@/components/meta-ads/AssetDetailClient";
import type { AssetDetailResponseDto, CreativePackageDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const DETAIL: AssetDetailResponseDto = {
  adAccountId: "act_752604553578354",
  generatedAt: "2026-08-31T00:00:00.000Z",
  assetKind: "IMAGE",
  assetId: "hash-A",
  adCount: 2,
  spend: 300_000,
  impressions: 5_000,
  clicks: 100,
  totalLead: 3,
  maxFrequency: 2.1,
  rphLead: 100_000,
  copyVariants: [
    {
      adId: "meta-1",
      stableId: "C001",
      name: "Ad Variant 1",
      branch: "CINERE",
      audienceLabel: "BROAD",
      spend: 200_000,
      impressions: 3_000,
      clicks: 60,
      totalLead: 2,
      frequency: 2.1,
      cpl: 100_000,
    },
    {
      adId: "meta-2",
      stableId: "C002",
      name: "Ad Variant 2",
      branch: "CINERE",
      audienceLabel: "INTEREST",
      spend: 100_000,
      impressions: 2_000,
      clicks: 40,
      totalLead: 1,
      frequency: 1.2,
      cpl: 100_000,
    },
  ],
  audienceBreakdown: [
    {
      audienceLabel: "BROAD",
      adCount: 1,
      spend: 200_000,
      impressions: 3_000,
      clicks: 60,
      totalLead: 2,
      maxFrequency: 2.1,
      cpl: 100_000,
    },
    {
      audienceLabel: "INTEREST",
      adCount: 1,
      spend: 100_000,
      impressions: 2_000,
      clicks: 40,
      totalLead: 1,
      maxFrequency: 1.2,
      cpl: 100_000,
    },
  ],
  topAudienceLabel: "BROAD",
  insight: { available: true, summary: "Audiens BROAD paling efisien untuk aset ini." },
};

describe("AssetDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading spinner, then renders the summary, insight, and both tables on a successful fetch", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)) as unknown as typeof fetch);

    render(<AssetDetailClient assetId="hash-A" />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("asset-insight")).toBeInTheDocument();
    });
    expect(screen.getByTestId("asset-insight")).toHaveTextContent(
      "Audiens BROAD paling efisien untuk aset ini.",
    );
    expect(screen.getAllByTestId("copy-variant-row")).toHaveLength(2);
    expect(screen.getAllByTestId("audience-breakdown-row")).toHaveLength(2);
    expect(
      screen.getByText((_, element) => element?.textContent === "#C001 · Ad Variant 1"),
    ).toBeInTheDocument();
  });

  it("renders an ErrorCard (not-found message) on a 404 from the proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { message: "not found" } }, 404),
      ) as unknown as typeof fetch,
    );

    render(<AssetDetailClient assetId="missing-asset" />);

    await waitFor(() => {
      expect(screen.getByTestId("error-card")).toBeInTheDocument();
    });
    expect(screen.getByTestId("error-card")).toHaveTextContent("missing-asset");
  });

  it("shows the degraded insight message when the LLM insight is unavailable, without failing the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...DETAIL,
          insight: {
            available: false,
            reason: "NO_API_KEY",
            message: "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
          },
        }),
      ) as unknown as typeof fetch,
    );

    render(<AssetDetailClient assetId="hash-A" />);

    await waitFor(() => {
      expect(screen.getByTestId("asset-insight")).toHaveTextContent(
        "Aktifkan AI Analysis dengan menambahkan OPENAI_API_KEY di settings",
      );
    });
  });

  it("'Brief ke Kai' POSTs a real prefilled body to /api/creative, derived from this asset's own data", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/analytics/assets/")) {
        return jsonResponse(DETAIL);
      }
      if (url === "/api/creative") {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string) as Record<string, unknown>;
        expect(body).toMatchObject({
          unit: "Ad Variant 1",
          branch: "CINERE",
          origin: "SAMANTHA",
          generate: false,
        });
        expect(body.reason).toContain("hash-A");
        return jsonResponse({
          package: { id: "pkg-1", title: "Brief Test" } as unknown as CreativePackageDto,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();

    render(<AssetDetailClient assetId="hash-A" />);
    await waitFor(() => {
      expect(screen.getByText("📋 Brief ke Kai")).toBeInTheDocument();
    });
    await user.click(screen.getByText("📋 Brief ke Kai"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/creative",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
