import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetLibraryClient } from "@/components/assets/AssetLibraryClient";
import type { AssetDto, AssetStatsDto } from "@/types/dashboard.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PHOTO: AssetDto = {
  id: "asset-1",
  type: "UNIT_PHOTO",
  status: "ACTIVE",
  storagePath: "units/xpander-cross-2019/foto-1.jpg",
  publicUrl: "https://storage.googleapis.com/aoos/units/xpander-cross-2019/foto-1.jpg",
  fileName: "foto-1.jpg",
  mimeType: "image/jpeg",
  fileSize: 2_400_000,
  tags: ["unit", "cinere"],
  unitId: "xpander-cross-2019",
  unitModel: "Xpander Cross",
  unitYear: 2019,
  branch: "CINERE",
  createdAt: "2026-08-14T07:32:00.000Z",
  updatedAt: "2026-08-14T07:32:00.000Z",
};

const VIDEO: AssetDto = {
  id: "asset-2",
  type: "AI_VIDEO",
  status: "ACTIVE",
  storagePath: "ai-creatives/brief-1/video-1.mp4",
  publicUrl: "https://storage.googleapis.com/aoos/ai-creatives/brief-1/video-1.mp4",
  fileName: "video-1.mp4",
  mimeType: "video/mp4",
  fileSize: 8_200_000,
  tags: [],
  branch: "CINERE",
  aiModel: "veo3_fast",
  aiPrompt: "Cinematic shot of a red Brio RS",
  creativeBriefId: "brief-1",
  createdAt: "2026-08-10T00:00:00.000Z",
  updatedAt: "2026-08-10T00:00:00.000Z",
};

const STATS: AssetStatsDto = {
  totalAssets: 412,
  byType: { UNIT_PHOTO: 312, AI_VIDEO: 18, AI_IMAGE: 82, BRAND: 0, TESTIMONIAL: 0, OVERLAY: 0 },
  byBranch: { CINERE: 18, BINTARO: 15 },
  byStatus: { ACTIVE: 412, ARCHIVED: 0, PENDING: 0 },
  totalSizeBytes: 5_242_880,
};

function mockFetch(overrides: Record<string, () => Response> = {}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: string | URL) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        return Promise.resolve(handler());
      }
    }
    if (url.includes("/api/settings")) {
      // Real vertical-resolution fetch (Sidebar.tsx's own convention) — unresolved by default,
      // same as every other test in this file that doesn't care about vertical branching, so the
      // pre-existing AUTOMOTIVE-branch-filter tests below keep passing unchanged.
      return Promise.resolve(jsonResponse({ error: { message: "unhandled in test" } }, 500));
    }
    if (url.includes("/api/assets/stats")) return Promise.resolve(jsonResponse(STATS));
    if (url.includes("/api/assets?")) {
      return Promise.resolve(
        jsonResponse({ assets: [PHOTO, VIDEO], total: 2, page: 1, limit: 48 }),
      );
    }
    return Promise.resolve(jsonResponse({ error: { message: "unhandled in test" } }, 500));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AssetLibraryClient — KPI strip and grid", () => {
  it("renders real KPI counts from /api/assets/stats", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    const kpi = await screen.findByTestId("asset-kpi");
    expect(kpi.textContent).toContain("412");
    expect(kpi.textContent).toContain("312");
    expect(kpi.textContent).toContain("18");
    expect(kpi.textContent).toContain("5.0 MB");
  });

  it("renders one card per real asset with its real metadata", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    const grid = await screen.findByTestId("asset-grid");
    expect(grid.textContent).toContain("foto-1.jpg");
    expect(grid.textContent).toContain("Xpander Cross 2019");
    expect(grid.textContent).toContain("2.3 MB");
    expect(grid.textContent).toContain("video-1.mp4");
    expect(grid.textContent).toContain("veo3_fast");
  });

  it("never renders fabricated dimensions, duration or a 'Dipakai di' usage list", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    const grid = await screen.findByTestId("asset-grid");
    expect(grid.textContent).not.toMatch(/\d+×\d+/);
    expect(grid.textContent).not.toContain("Dipakai di");
    expect(grid.textContent).not.toMatch(/#KAI-/);
  });

  it("renders a placeholder (not a broken <img>) for a video asset", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");
    expect(screen.getByAltText("foto-1.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("video-1.mp4")).not.toBeInTheDocument();
  });

  it("shows the empty state when the library is genuinely empty", async () => {
    mockFetch({
      "/api/assets?": () => jsonResponse({ assets: [], total: 0, page: 1, limit: 48 }),
    });
    render(<AssetLibraryClient />);
    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("surfaces the 503 'not configured' error rather than an empty grid", async () => {
    mockFetch({
      "/api/assets?": () =>
        jsonResponse(
          { error: { message: "Asset library is not configured on this deployment" } },
          503,
        ),
    });
    render(<AssetLibraryClient />);
    expect(
      await screen.findByText(/Asset library is not configured on this deployment/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("asset-grid")).not.toBeInTheDocument();
  });
});

describe("AssetLibraryClient — filters", () => {
  it("sends NO type param for the 'Semua' tab", async () => {
    const fetchMock = mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    const listCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/assets?"));
    expect(String(listCall?.[0])).not.toContain("type=");
  });

  it("filters by a REAL AssetType when a type tab is clicked", async () => {
    const fetchMock = mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    await userEvent.click(screen.getByRole("button", { name: /AI Video/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("type=AI_VIDEO"))).toBe(
        true,
      );
    });
  });

  it("exposes only real Branch enum members in the branch filter", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    const select = screen.getByLabelText("Cabang");
    const options = Array.from(select.querySelectorAll("option")).map((o) => o.value);
    expect(options).toEqual([
      "",
      "CINERE",
      "BINTARO",
      "BANDUNG",
      "JABODETABEK",
      "BOOST",
      "MULTI",
      "UMUM",
    ]);
    expect(options).not.toContain("PONDOK_BAMBU");
  });

  it("filters by branch and by sort order", async () => {
    const fetchMock = mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    await userEvent.selectOptions(screen.getByLabelText("Cabang"), "BINTARO");
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("branch=BINTARO"))).toBe(true);
    });

    await userEvent.selectOptions(screen.getByLabelText("Urutkan"), "oldest");
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("sort=oldest"))).toBe(true);
    });
  });

  it("searches by file name", async () => {
    const fetchMock = mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    await userEvent.type(screen.getByLabelText("Cari asset"), "foto-1");
    await userEvent.click(screen.getByRole("button", { name: "Cari" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("search=foto-1"))).toBe(true);
    });
  });

  it("paginates using the real total, and disables Sebelumnya on page 1", async () => {
    const fetchMock = mockFetch({
      "/api/assets?": () => jsonResponse({ assets: [PHOTO], total: 100, page: 1, limit: 48 }),
    });
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    expect(screen.getByRole("button", { name: /Sebelumnya/ })).toBeDisabled();
    expect(screen.getByText(/Halaman 1 dari 3/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Berikutnya/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("page=2"))).toBe(true);
    });
  });
});

describe("AssetLibraryClient — PROPERTY vertical (Tenant-Scoping Fix, Phase T2)", () => {
  function mockFetchProperty(
    overrides: Record<string, () => Response> = {},
  ): ReturnType<typeof vi.fn> {
    return mockFetch({
      "/api/settings": () => jsonResponse({ tenant: { vertical: "PROPERTY" } }),
      ...overrides,
    });
  }

  it("hides the Branch filter for a PROPERTY tenant", async () => {
    mockFetchProperty();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    expect(screen.queryByLabelText("Cabang")).not.toBeInTheDocument();
  });

  it("never renders a branch value on the card for a PROPERTY tenant", async () => {
    mockFetchProperty();
    render(<AssetLibraryClient />);
    const grid = await screen.findByTestId("asset-grid");

    expect(grid.textContent).not.toContain("CINERE");
  });

  it("never sends a branch filter param for a PROPERTY tenant", async () => {
    const fetchMock = mockFetchProperty();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    const listCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/assets?"));
    expect(String(listCall?.[0])).not.toContain("branch=");
  });

  it("shows a PROPERTY-appropriate empty-state hint, not 'Scraper Mobix'", async () => {
    mockFetchProperty({
      "/api/assets?": () => jsonResponse({ assets: [], total: 0, page: 1, limit: 48 }),
    });
    render(<AssetLibraryClient />);
    expect(await screen.findByText(/Listing Manager/)).toBeInTheDocument();
    expect(screen.queryByText(/Scraper Mobix/)).not.toBeInTheDocument();
  });

  it("still shows the Branch filter for AUTOMOTIVE (default/unresolved vertical)", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");

    expect(screen.getByLabelText("Cabang")).toBeInTheDocument();
  });
});

describe("AssetLibraryClient — detail modal", () => {
  async function openDetail(): Promise<void> {
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");
    await userEvent.click(screen.getByRole("button", { name: /Buka detail foto-1\.jpg/ }));
    await screen.findByTestId("asset-detail");
  }

  it("shows the asset's real metadata including its GCS path", async () => {
    mockFetch();
    await openDetail();
    const modal = screen.getByTestId("asset-detail");
    expect(modal.textContent).toContain("units/xpander-cross-2019/foto-1.jpg");
    expect(modal.textContent).toContain("UNIT_PHOTO");
    expect(modal.textContent).toContain("Xpander Cross 2019");
    expect(modal.textContent).toContain("image/jpeg");
    expect(modal.textContent).toContain("unit, cinere");
  });

  it("shows the real AI prompt for an AI asset", async () => {
    mockFetch();
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");
    await userEvent.click(screen.getByRole("button", { name: /Buka detail video-1\.mp4/ }));

    const modal = await screen.findByTestId("asset-detail");
    expect(modal.textContent).toContain("Cinematic shot of a red Brio RS");
    expect(modal.textContent).toContain("veo3_fast");
    expect(modal.textContent).toContain("brief-1");
  });

  it("labels the removal action 'Arsipkan' and explains that nothing is permanently deleted", async () => {
    mockFetch();
    await openDetail();
    expect(screen.getByRole("button", { name: /Arsipkan/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus permanen/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Tidak ada hapus permanen/)).toBeInTheDocument();
  });

  it("requires a confirmation before archiving, then issues a real DELETE", async () => {
    const fetchMock = mockFetch({
      "/api/assets/asset-1": () => jsonResponse({ ...PHOTO, status: "ARCHIVED" }),
    });
    await openDetail();

    await userEvent.click(screen.getByRole("button", { name: /Arsipkan/ }));
    // Nothing is sent until the second, explicit confirmation.
    expect(
      fetchMock.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === "DELETE"),
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Ya, arsipkan" }));
    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(String(deleteCall?.[0])).toBe("/api/assets/asset-1");
    });
    await waitFor(() => {
      expect(screen.getByTestId("asset-detail").textContent).toContain("ARCHIVED");
    });
  });

  it("hides the archive action for an already-ARCHIVED asset", async () => {
    mockFetch({
      "/api/assets?": () =>
        jsonResponse({
          assets: [{ ...PHOTO, status: "ARCHIVED" }],
          total: 1,
          page: 1,
          limit: 48,
        }),
    });
    render(<AssetLibraryClient />);
    await screen.findByTestId("asset-grid");
    await userEvent.click(screen.getByRole("button", { name: /Buka detail foto-1\.jpg/ }));
    await screen.findByTestId("asset-detail");

    expect(screen.queryByRole("button", { name: /Arsipkan/ })).not.toBeInTheDocument();
  });

  it("opens the real signed URL returned by the download endpoint", async () => {
    mockFetch({
      "/download": () =>
        jsonResponse({
          url: "https://storage.googleapis.com/aoos/units/x/foto-1.jpg?X-Goog-Signature=abc",
          expiresInSeconds: 3600,
        }),
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    await openDetail();

    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://storage.googleapis.com/aoos/units/x/foto-1.jpg?X-Goog-Signature=abc",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("surfaces a signing failure instead of opening a broken tab", async () => {
    mockFetch({
      "/download": () =>
        jsonResponse({ error: { message: "cannot sign without a private key" } }, 500),
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    await openDetail();

    await userEvent.click(screen.getByRole("button", { name: /Download/ }));
    expect(await screen.findByText("cannot sign without a private key")).toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("copies the real GCS storage path", async () => {
    mockFetch();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await openDetail();

    await userEvent.click(screen.getByRole("button", { name: /Copy GCS path/ }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("units/xpander-cross-2019/foto-1.jpg");
    });
  });
});
