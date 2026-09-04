import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScraperClient } from "@/components/assets/ScraperClient";
import type { ScrapeJobDto, ScrapedUnitDto, ScraperStatusDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const UNIT: ScrapedUnitDto = {
  unitId: "xpander-cross-2019",
  url: "https://mobixbydss.id/unit/xpander-cross-2019",
  brand: "Mitsubishi",
  model: "Xpander Cross",
  year: 2019,
  transmission: "AT",
  color: "Silver",
  kilometer: 45_000,
  priceIdr: 195_000_000,
  branch: "CINERE",
  photos: ["https://cdn.mobixbydss.id/x/1.jpg"],
  photoCount: 12,
  available: true,
  scrapedAt: "2026-08-14T07:32:00.000Z",
};

const STATUS: ScraperStatusDto = {
  totalUnits: 48,
  availableUnits: 45,
  totalPhotos: 312,
  byBranch: { CINERE: 18, BINTARO: 15 },
  lastScrapedAt: "2026-08-14T07:32:00.000Z",
  lastJob: {
    id: "job-0",
    kind: "FULL",
    status: "DONE",
    progressCurrent: 48,
    progressTotal: 48,
    result: {
      unitsScraped: 48,
      newUnits: 3,
      soldUnits: 1,
      photosStored: 312,
      photosFailed: 0,
      unitsPersisted: 48,
    },
    logs: [],
    createdAt: "2026-08-14T07:30:00.000Z",
    updatedAt: "2026-08-14T07:32:00.000Z",
  },
};

const RUNNING_JOB: ScrapeJobDto = {
  id: "job-1",
  kind: "FULL",
  status: "RUNNING",
  progressCurrent: 2,
  progressTotal: 4,
  logs: [
    {
      level: "INFO",
      message: "Listing mobixbydss.id diparse — 4 unit ditemukan.",
      createdAt: "2026-08-17T00:00:01.000Z",
    },
  ],
  createdAt: "2026-08-17T00:00:00.000Z",
  updatedAt: "2026-08-17T00:00:01.000Z",
};

const DONE_JOB: ScrapeJobDto = {
  ...RUNNING_JOB,
  status: "DONE",
  progressCurrent: 4,
  logs: [
    ...RUNNING_JOB.logs,
    {
      level: "INFO",
      message: "Selesai: 4 unit, 9 foto tersimpan.",
      createdAt: "2026-08-17T00:00:05.000Z",
    },
  ],
  result: {
    unitsScraped: 4,
    newUnits: 1,
    soldUnits: 0,
    photosStored: 9,
    photosFailed: 0,
    unitsPersisted: 4,
  },
};

/**
 * Note: `EventSource` does not exist in jsdom, so `ScraperClient` takes its documented polling
 * fallback path in these tests — which is exactly the branch worth covering here (the real SSE
 * transport is verified end-to-end over a socket by `apps/aaos-api/test/scraper-assets.e2e.spec.ts`).
 */
function mockFetch(overrides: Record<string, () => Response> = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: string | URL) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        return Promise.resolve(handler());
      }
    }
    if (url.includes("/api/scraper/status")) return Promise.resolve(jsonResponse(STATUS));
    if (url.includes("/api/scraper/stock")) {
      return Promise.resolve(jsonResponse({ units: [UNIT], total: 1, page: 1, limit: 60 }));
    }
    if (url.includes("/api/assets")) return Promise.resolve(jsonResponse({ assets: [] }));
    return Promise.resolve(jsonResponse({ error: { message: "unhandled in test" } }, 500));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScraperClient — KPI strip and unit grid", () => {
  it("renders real KPI values from /api/scraper/status", async () => {
    mockFetch();
    render(<ScraperClient />);

    const kpi = await screen.findByTestId("scraper-kpi");
    expect(kpi.textContent).toContain("48");
    expect(kpi.textContent).toContain("45");
    expect(kpi.textContent).toContain("312");
  });

  it("shows 'Belum pernah' instead of a fabricated timestamp when nothing has been scraped", async () => {
    mockFetch({
      "/api/scraper/status": () =>
        jsonResponse({ totalUnits: 0, availableUnits: 0, totalPhotos: 0, byBranch: {} }),
    });
    render(<ScraperClient />);

    const kpi = await screen.findByTestId("scraper-kpi");
    expect(kpi.textContent).toContain("Belum pernah");
  });

  it("renders the last real job summary", async () => {
    mockFetch();
    render(<ScraperClient />);
    const lastJob = await screen.findByTestId("scraper-last-job");
    expect(lastJob.textContent).toContain("DONE");
    expect(lastJob.textContent).toContain("48 unit");
  });

  it("renders a unit card with real price, km, branch and photo count", async () => {
    mockFetch();
    render(<ScraperClient />);

    const grid = await screen.findByTestId("scraper-unit-grid");
    expect(grid.textContent).toContain("Mitsubishi Xpander Cross 2019");
    expect(grid.textContent).toContain("AT");
    expect(grid.textContent).toContain("Silver");
    expect(grid.textContent).toContain("CINERE");
    expect(grid.textContent).toContain("12 foto");
  });

  it("states honestly that photos are not re-downloaded for already-ingested units", async () => {
    mockFetch();
    render(<ScraperClient />);
    expect(
      await screen.findByText(/Foto unit yang sudah pernah diunduh tidak diunduh ulang/),
    ).toBeInTheDocument();
  });

  it("shows an empty state (not a fake unit) when no stock is persisted yet", async () => {
    mockFetch({
      "/api/scraper/stock": () => jsonResponse({ units: [], total: 0, page: 1, limit: 60 }),
    });
    render(<ScraperClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("surfaces an upstream 503 as an error card rather than an empty grid", async () => {
    mockFetch({
      "/api/scraper/stock": () =>
        jsonResponse({ error: { message: "scraped_units not configured" } }, 503),
    });
    render(<ScraperClient />);
    expect(await screen.findByText("scraped_units not configured")).toBeInTheDocument();
  });

  it("only renders branch tabs for branches that really have stock", async () => {
    mockFetch();
    render(<ScraperClient />);
    expect(await screen.findByRole("button", { name: /CINERE \(18\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /BINTARO \(15\)/ })).toBeInTheDocument();
    // No stock in BANDUNG → no tab, rather than a "BANDUNG (0)" tab.
    expect(screen.queryByRole("button", { name: /BANDUNG/ })).not.toBeInTheDocument();
  });

  it("re-queries stock with the branch filter when a tab is clicked", async () => {
    const fetchMock = mockFetch();
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");

    await userEvent.click(screen.getByRole("button", { name: /CINERE \(18\)/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("branch=CINERE"))).toBe(
        true,
      );
    });
  });

  it("re-queries stock with the search term", async () => {
    const fetchMock = mockFetch();
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");

    await userEvent.type(screen.getByLabelText("Cari unit"), "xpander");
    await userEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("search=xpander"))).toBe(
        true,
      );
    });
  });
});

describe("ScraperClient — scrape job", () => {
  it("POSTs an empty body for a full scrape and shows the progress modal with REAL log lines", async () => {
    const fetchMock = mockFetch({
      "/api/scraper/run": () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "FULL" }, 202),
      "/api/scraper/jobs/job-1": () => jsonResponse(RUNNING_JOB),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");

    await userEvent.click(screen.getByRole("button", { name: /Scrape Semua Ulang/ }));

    const modal = await screen.findByTestId("scrape-progress");
    await waitFor(() => {
      expect(modal.textContent).toContain("Listing mobixbydss.id diparse — 4 unit ditemukan.");
    });
    expect(modal.textContent).toContain("2/4 unit");

    const runCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/api/scraper/run"),
    );
    expect(JSON.parse(String((runCall?.[1] as RequestInit).body))).toEqual({});
  });

  it("POSTs the unit URL for a single-unit re-scrape", async () => {
    const fetchMock = mockFetch({
      "/api/scraper/run": () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "UNIT" }, 202),
      "/api/scraper/jobs/job-1": () => jsonResponse(DONE_JOB),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");

    await userEvent.click(screen.getByRole("button", { name: "Scrape ulang" }));

    await waitFor(() => {
      const runCall = fetchMock.mock.calls.find((call) =>
        String(call[0]).includes("/api/scraper/run"),
      );
      expect(JSON.parse(String((runCall?.[1] as RequestInit).body))).toEqual({
        unitUrl: "https://mobixbydss.id/unit/xpander-cross-2019",
      });
    });
  });

  it("shows the real measured result once the job finishes", async () => {
    mockFetch({
      "/api/scraper/run": () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "FULL" }, 202),
      "/api/scraper/jobs/job-1": () => jsonResponse(DONE_JOB),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: /Scrape Semua Ulang/ }));

    const modal = await screen.findByTestId("scrape-progress");
    await waitFor(() => {
      expect(modal.textContent).toContain("9 foto tersimpan");
    });
    expect(modal.textContent).toContain("1 baru");
  });

  it("shows an indeterminate label (no fabricated denominator) before the listing is parsed", async () => {
    mockFetch({
      "/api/scraper/run": () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "FULL" }, 202),
      "/api/scraper/jobs/job-1": () =>
        jsonResponse({ ...RUNNING_JOB, progressCurrent: 0, progressTotal: undefined, logs: [] }),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: /Scrape Semua Ulang/ }));

    const modal = await screen.findByTestId("scrape-progress");
    await waitFor(() => {
      expect(modal.textContent).toContain("Menunggu listing diparse…");
    });
  });

  it("shows the real error message when the job fails", async () => {
    mockFetch({
      "/api/scraper/run": () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "FULL" }, 202),
      "/api/scraper/jobs/job-1": () =>
        jsonResponse({
          ...RUNNING_JOB,
          status: "ERROR",
          errorMessage: "listing responded with status 503",
        }),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: /Scrape Semua Ulang/ }));

    expect(await screen.findByText("listing responded with status 503")).toBeInTheDocument();
  });

  it("surfaces a failure to start the job", async () => {
    mockFetch({
      "/api/scraper/run": () => jsonResponse({ error: { message: "Gagal memulai." } }, 500),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: /Scrape Semua Ulang/ }));

    expect(await screen.findByText("Gagal memulai.")).toBeInTheDocument();
    expect(screen.queryByTestId("scrape-progress")).not.toBeInTheDocument();
  });
});

describe("ScraperClient — unit detail modal", () => {
  it("loads that unit's REAL stored GCS assets via /api/assets?unitId=", async () => {
    const fetchMock = mockFetch({
      "/api/assets": () =>
        jsonResponse({
          assets: [
            {
              id: "asset-1",
              type: "UNIT_PHOTO",
              status: "ACTIVE",
              storagePath: "units/xpander-cross-2019/foto-1.jpg",
              publicUrl: "https://storage.googleapis.com/aoos/units/x/foto-1.jpg",
              fileName: "foto-1.jpg",
              mimeType: "image/jpeg",
              fileSize: 2_400_000,
              tags: [],
              createdAt: "2026-08-14T07:32:00.000Z",
              updatedAt: "2026-08-14T07:32:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          limit: 48,
        }),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");

    await userEvent.click(screen.getByRole("button", { name: "Lihat foto" }));

    const modal = await screen.findByTestId("unit-detail");
    expect(modal.textContent).toContain("Mitsubishi Xpander Cross 2019 · CINERE");
    expect(modal.textContent).toContain("45.000");
    await waitFor(() => {
      expect(screen.getByAltText("foto-1.jpg")).toBeInTheDocument();
    });

    const assetCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/assets?"));
    expect(String(assetCall?.[0])).toContain("unitId=xpander-cross-2019");
    expect(String(assetCall?.[0])).toContain("type=UNIT_PHOTO");
  });

  it("says plainly when no GCS photos exist for the unit yet", async () => {
    mockFetch({
      "/api/assets": () => jsonResponse({ assets: [], total: 0, page: 1, limit: 48 }),
    });
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: "Lihat foto" }));

    expect(
      await screen.findByText(/Belum ada foto unit ini yang tersimpan di GCS/),
    ).toBeInTheDocument();
  });

  it("closes on Tutup", async () => {
    mockFetch();
    render(<ScraperClient />);
    await screen.findByTestId("scraper-unit-grid");
    await userEvent.click(screen.getByRole("button", { name: "Lihat foto" }));
    await screen.findByTestId("unit-detail");

    await userEvent.click(screen.getByRole("button", { name: "Tutup" }));
    await waitFor(() => {
      expect(screen.queryByTestId("unit-detail")).not.toBeInTheDocument();
    });
  });
});
