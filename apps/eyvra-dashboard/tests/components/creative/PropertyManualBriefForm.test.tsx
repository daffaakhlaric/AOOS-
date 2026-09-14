import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PropertyManualBriefForm } from "@/components/creative/PropertyManualBriefForm";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LISTING = {
  id: "listing-1",
  title: "Rumah Bintaro 88m²",
  propertyType: "RUMAH",
  listingStatus: "AKTIF",
  price: 1_800_000_000,
  highlights: [],
  photos: [
    { id: "p1", url: "https://gcs/listing-1/photo-1.jpg", order: 0, isMain: true },
    { id: "p2", url: "https://gcs/listing-1/photo-2.jpg", order: 1, isMain: false },
  ],
  documents: [],
  inKnowledgeBase: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

function mockFetch(
  overrides: {
    readonly listings?: readonly unknown[];
    readonly packages?: readonly unknown[];
  } = {},
) {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/listings")) {
      const listings = overrides.listings ?? [LISTING];
      return jsonResponse({ listings, total: listings.length });
    }
    if (url.includes("/api/creative") && init?.method !== "POST") {
      return jsonResponse({ packages: overrides.packages ?? [] });
    }
    return jsonResponse(
      { package: { id: "pkg-1", title: "T", status: "DRAFT", vertical: "PROPERTY" } },
      200,
    );
  });
}

function propertyPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: "pkg-existing",
    briefId: "brief-existing",
    vertical: "PROPERTY",
    listingId: "listing-other",
    title: "Brief",
    angle: "INVESTASI",
    reason: "",
    requestedFormat: "IMAGES_ONLY",
    primaryMessage: "",
    urgency: "MEDIUM",
    origin: "MANUAL",
    status: "APPROVED",
    sourcePhotoUrls: [],
    imageUrls: [],
    copyVariants: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PropertyManualBriefForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads listings from the real GET /api/listings endpoint (the same one Listing Manager uses)", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Rumah Bintaro 88m²/ })).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.some(([i]) => String(i).includes("/api/listings"))).toBe(true);
  });

  it("offers the REAL 8 PropertyAdAngle members as pill buttons (Sprint 5 Prompt 14: chips, not a <select>, so a 'Direkomendasikan' badge can attach to one)", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "DP_RINGAN" })).toBeInTheDocument(),
    );
    for (const angle of [
      "DP_RINGAN",
      "READY_HUNI",
      "INVESTASI",
      "EXCLUSIVE",
      "SYARIAH",
      "PROMO_TERBATAS",
      "TESTIMONIAL",
      "VIRTUAL_TOUR",
    ]) {
      expect(screen.getByRole("button", { name: angle })).toBeInTheDocument();
    }
  });

  it("previews the selected listing's real photos", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("creative-photo-strip")).toBeInTheDocument());
    expect(screen.getAllByAltText("Foto listing")).toHaveLength(2);
  });

  // Kai Creative Engine Sprint 4 — real, on-demand, per-photo Vision analysis.
  it("'Analisa Foto' calls the real /api/creative/photo-analysis proxy for that photo and renders the result", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/listings")) {
        return jsonResponse({ listings: [LISTING], total: 1 });
      }
      if (url === "/api/creative/photo-analysis") {
        const body = JSON.parse(init?.body as string) as { photoUrl: string };
        expect(body.photoUrl).toBe("https://gcs/listing-1/photo-1.jpg");
        return jsonResponse({
          available: true,
          scene: "EKSTERIOR",
          qualityScore: 82,
          marketingScore: 74,
          recommendedUse: "HERO",
          reasoning: "x",
        });
      }
      if (url.includes("/api/creative") && init?.method !== "POST") {
        return jsonResponse({ packages: [] });
      }
      return jsonResponse({ package: { id: "pkg-1" } });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { default: userEventModule } = await import("@testing-library/user-event");
    const user = userEventModule.setup();

    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("creative-photo-strip")).toBeInTheDocument());

    const [firstButton] = screen.getAllByRole("button", { name: "🔍 Analisa Foto" });
    await user.click(firstButton!);

    await waitFor(() => expect(screen.getByTestId("photo-analysis-p1")).toBeInTheDocument());
    expect(screen.getByTestId("photo-analysis-p1")).toHaveTextContent("EKSTERIOR");
    expect(screen.getByTestId("photo-analysis-p1")).toHaveTextContent("HERO");
    // The second photo's own button is untouched — this call was scoped to ONE photo, not all.
    expect(screen.getAllByRole("button", { name: "🔍 Analisa Foto" })).toHaveLength(1);
  });

  it("shows an honest 'belum ada listing' message instead of a broken empty dropdown", async () => {
    global.fetch = mockFetch({ listings: [] }) as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("property-brief-no-listings")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("property-brief-no-listings")).toHaveTextContent(
      /Belum ada listing aktif/,
    );
    expect(screen.getByRole("button", { name: /Kirim ke Kai/ })).toBeDisabled();
  });

  it("says plainly when a listing has no photos rather than pretending it does", async () => {
    global.fetch = mockFetch({
      listings: [{ ...LISTING, photos: [] }],
    }) as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Listing ini belum punya foto/)).toBeInTheDocument(),
    );
  });

  it("submits the real PropertyCreatePackageBodySchema shape: listingId + angle, not unit/branch/targetPersona", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    const onCreated = vi.fn();
    render(<PropertyManualBriefForm onCreated={onCreated} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Rumah Bintaro 88m²/ })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const post = fetchMock.mock.calls.find(
      ([i, init]) => String(i).includes("/api/creative/property") && init?.method === "POST",
    );
    expect(post).toBeDefined();
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body["listingId"]).toBe("listing-1");
    expect(body["angle"]).toBe("DP_RINGAN");
    expect(body["format"]).toBe("VIDEO_AND_IMAGES");
    expect(body["generate"]).toBe(false);
    expect(body["origin"]).toBe("MANUAL");
    // 042_creative_packages_ai_recommended.sql — a manually-picked angle with no accepted
    // recommendation must submit `aiRecommended: false`, never assumed true.
    expect(body["aiRecommended"]).toBe(false);
    expect(body).not.toHaveProperty("unit");
    expect(body).not.toHaveProperty("branch");
    expect(body).not.toHaveProperty("targetPersona");
  });

  it("submits generate:true only from the explicit “Kirim ke Kai” button, and posts to /api/creative/property", async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Rumah Bintaro 88m²/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Kirim ke Kai/ }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(post?.[0])).toBe("/api/creative/property");
    const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
    expect(body["generate"]).toBe(true);
  });

  it("surfaces an upstream validation error instead of silently succeeding", async () => {
    global.fetch = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/listings")) {
        return jsonResponse({ listings: [LISTING], total: 1 });
      }
      return jsonResponse({ error: { message: "angle: Invalid enum value" } }, 422);
    }) as unknown as typeof fetch;

    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Rumah Bintaro 88m²/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));
    await waitFor(() =>
      expect(screen.getByTestId("error-card")).toHaveTextContent(/Invalid enum value/),
    );
  });

  describe("Sprint 5 Prompt 14 — Step 2 Kai recommendation + Step 3 pre-selection", () => {
    it("shows a TINGGI-confidence card pre-checked, with the recommended angle chip pre-selected and tagged 'Direkomendasikan'", async () => {
      global.fetch = mockFetch({
        packages: ["listing-other-1", "listing-other-2", "listing-other-3"].map((listingId) =>
          propertyPackage({ listingId, angle: "INVESTASI" }),
        ),
      }) as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);

      await waitFor(() => expect(screen.getByTestId("kai-recommendations")).toBeInTheDocument());
      expect(screen.getByTestId("confidence-badge-INVESTASI")).toHaveTextContent("Tinggi");
      const checkbox = screen
        .getByTestId("kai-recommendations")
        .querySelector("input[type=checkbox]");
      expect(checkbox).toBeChecked();

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /INVESTASI/ })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );
      expect(screen.getByText("Direkomendasikan")).toBeInTheDocument();
    });

    it("042_creative_packages_ai_recommended: submits aiRecommended:true when the pre-checked TINGGI recommendation is what's actually sent", async () => {
      const fetchMock = mockFetch({
        packages: ["listing-other-1", "listing-other-2", "listing-other-3"].map((listingId) =>
          propertyPackage({ listingId, angle: "INVESTASI" }),
        ),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);

      await waitFor(() => expect(screen.getByTestId("kai-recommendations")).toBeInTheDocument());
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /INVESTASI/ })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      );

      await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));
      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
      );
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
      expect(body["angle"]).toBe("INVESTASI");
      expect(body["aiRecommended"]).toBe(true);
    });

    it("042_creative_packages_ai_recommended: unchecking the recommendation before picking a DIFFERENT angle submits aiRecommended:false", async () => {
      const fetchMock = mockFetch({
        packages: ["listing-other-1", "listing-other-2", "listing-other-3"].map((listingId) =>
          propertyPackage({ listingId, angle: "INVESTASI" }),
        ),
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);

      await waitFor(() => expect(screen.getByTestId("kai-recommendations")).toBeInTheDocument());
      // Manually pick a DIFFERENT angle than the one Kai recommended — the submitted angle no
      // longer matches any accepted recommendation, so this must be honestly false.
      await userEvent.click(screen.getByRole("button", { name: "SYARIAH" }));

      await userEvent.click(screen.getByRole("button", { name: /Simpan sebagai Draft/ }));
      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
      );
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      const body = JSON.parse(String(post?.[1]?.body)) as Record<string, unknown>;
      expect(body["angle"]).toBe("SYARIAH");
      expect(body["aiRecommended"]).toBe(false);
    });

    it("does NOT pre-check a SEDANG/COBA_COBA recommendation, and does not recommend the current listing's already-used angle", async () => {
      global.fetch = mockFetch({
        packages: [
          propertyPackage({ listingId: "listing-other", angle: "EXCLUSIVE", status: "APPROVED" }),
          propertyPackage({ listingId: "listing-1", angle: "DP_RINGAN", status: "APPROVED" }),
        ],
      }) as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);

      await waitFor(() => expect(screen.getByTestId("kai-recommendations")).toBeInTheDocument());
      expect(screen.getByTestId("confidence-badge-EXCLUSIVE")).toHaveTextContent("Sedang");
      // DP_RINGAN was already used for the currently-selected listing (listing-1) — never suggested.
      expect(screen.queryByTestId("confidence-badge-DP_RINGAN")).not.toBeInTheDocument();
    });

    it("honestly says a CTR-based performance prediction is unavailable rather than fabricating one", async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByTestId("performance-prediction-honest-note")).toHaveTextContent(
          /Prediksi performa belum tersedia/,
        ),
      );
    });

    it("shows no recommendation section at all when there is no real evidence for any angle", async () => {
      global.fetch = mockFetch({ packages: [] }) as unknown as typeof fetch;
      render(<PropertyManualBriefForm onCreated={vi.fn()} />);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "DP_RINGAN" })).toBeInTheDocument(),
      );
      expect(screen.queryByTestId("kai-recommendations")).not.toBeInTheDocument();
    });
  });
});
