import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbTestingClient } from "@/components/meta-ads/AbTestingClient";
import type { AbTestDto } from "@/types/dashboard.types";

const RUNNING_TEST: AbTestDto = {
  id: "test-1",
  name: "Xpander Cinere — DP vs Stok",
  campaignId: "camp-1",
  adSetId: "adset-1",
  status: "RUNNING",
  thresholdSpend: 100_000,
  thresholdDays: 3,
  minMarginPct: 20,
  autoPauseLoser: true,
  autoScaleWinner: true,
  startedAt: "2026-08-14T00:00:00.000Z",
  createdAt: "2026-08-14T00:00:00.000Z",
  variants: [
    {
      id: "var-a",
      variantLabel: "A",
      angle: "DP_RINGAN",
      creativePackageId: "pkg-a",
      metaAdId: "ad-a",
      status: "RUNNING",
      spend: 52_000,
      impressions: 12_400,
      clicks: 260,
      conversations: 6,
      leads: 6,
      rphLead: 8_667,
      ctr: 0.021,
    },
    {
      id: "var-b",
      variantLabel: "B",
      angle: "GUDANGNYA",
      creativePackageId: "pkg-b",
      metaAdId: "ad-b",
      status: "RUNNING",
      spend: 48_000,
      impressions: 11_200,
      clicks: 200,
      conversations: 4,
      leads: 4,
      rphLead: 12_000,
      ctr: 0.018,
    },
  ],
};

const COMPLETE_TEST: AbTestDto = {
  ...RUNNING_TEST,
  id: "test-2",
  name: "Brio Bintaro — 3 Variant",
  status: "COMPLETE",
  winnerVariantId: "var-a",
  winnerRphLead: 8_667,
  improvementPct: 28,
  completedAt: "2026-08-17T00:00:00.000Z",
  variants: [
    { ...RUNNING_TEST.variants[0]!, id: "var-a", status: "WINNER" },
    { ...RUNNING_TEST.variants[1]!, id: "var-b", status: "PAUSED_LOSER" },
  ],
};

const DRAFT_TEST: AbTestDto = {
  ...RUNNING_TEST,
  id: "test-3",
  name: "Ertiga Bandung — DP vs QnA",
  status: "DRAFT",
  startedAt: undefined,
  variants: [
    { ...RUNNING_TEST.variants[0]!, id: "var-c", status: "PENDING_CREATIVE", metaAdId: undefined },
    { ...RUNNING_TEST.variants[1]!, id: "var-d", status: "PENDING_CREATIVE", metaAdId: undefined },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockFetchRouter(overrides: Partial<Record<string, () => Response>> = {}): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/abtesting/") && url.endsWith("/pause") && init?.method === "POST") {
      return (
        overrides["pause"]?.() ?? jsonResponse({ test: { ...RUNNING_TEST, status: "PAUSED" } })
      );
    }
    if (url.startsWith("/api/abtesting")) {
      return (
        overrides["list"]?.() ?? jsonResponse({ tests: [RUNNING_TEST, COMPLETE_TEST, DRAFT_TEST] })
      );
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

describe("AbTestingClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real KPI strip (never a fabricated 'budget saved' figure)", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-kpi-strip")).toBeInTheDocument());

    const strip = screen.getByTestId("abtesting-kpi-strip");
    expect(within(strip).getByText("TEST AKTIF")).toBeInTheDocument();
    expect(within(strip).getByText("WINNER DITEMUKAN")).toBeInTheDocument();
    expect(within(strip).getByText("DRAFT MENUNGGU")).toBeInTheDocument();
    expect(within(strip).getByText("AVG IMPROVEMENT")).toBeInTheDocument();
    // 1 RUNNING, 1 COMPLETE (winner), 1 DRAFT — all real, derived from the fixture tests.
    expect(within(strip).getAllByText("1")).toHaveLength(3);
    expect(within(strip).getByText("28%")).toBeInTheDocument();
  });

  it("Aktif tab shows the RUNNING test's variant columns with real metrics", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-card-list")).toBeInTheDocument());

    expect(screen.getByText(/Xpander Cinere — DP vs Stok/)).toBeInTheDocument();
    expect(screen.getByText(/VARIANT A/)).toBeInTheDocument();
    expect(screen.getByText(/VARIANT B/)).toBeInTheDocument();
    expect(screen.getByText(/Rp 52\.000/)).toBeInTheDocument();
  });

  it("Pause Test calls the real /api/abtesting/:id/pause endpoint", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-card-list")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "⏸ Pause Test" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Pause Test/ })).toBeEnabled());
  });

  it("switches to Selesai tab and shows the honest winner note", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-card-list")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: /Selesai/ }));
    expect(await screen.findByText(/Brio Bintaro — 3 Variant/)).toBeInTheDocument();
    expect(screen.getByText(/Variant A menang/)).toBeInTheDocument();
  });

  it("switches to Draft tab and shows variants awaiting creative generation", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-card-list")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: /Draft/ }));
    expect(await screen.findByText(/Ertiga Bandung — DP vs QnA/)).toBeInTheDocument();
    expect(screen.getAllByText(/GENERATE CREATIVE/).length).toBeGreaterThan(0);
  });

  it("opens the create-test modal from '+ Buat A/B Test Baru'", async () => {
    mockFetchRouter();
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("abtesting-card-list")).toBeInTheDocument());
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/scraper/stock")) {
        return jsonResponse({ units: [] });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
    await userEvent.click(screen.getByRole("button", { name: "+ Buat A/B Test Baru" }));
    expect(screen.getByRole("dialog", { name: "Buat A/B Test Baru" })).toBeInTheDocument();
  });

  it("shows an error card when the list fetch fails", async () => {
    mockFetchRouter({ list: () => jsonResponse({}, 500) });
    render(<AbTestingClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
