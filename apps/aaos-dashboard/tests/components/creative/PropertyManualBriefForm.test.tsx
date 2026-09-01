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

function mockFetch(overrides: { readonly listings?: readonly unknown[] } = {}) {
  return vi.fn(async (input: string | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/listings")) {
      const listings = overrides.listings ?? [LISTING];
      return jsonResponse({ listings, total: listings.length });
    }
    return jsonResponse(
      { package: { id: "pkg-1", title: "T", status: "DRAFT", vertical: "PROPERTY" } },
      200,
    );
  });
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

  it("offers the REAL 8 PropertyAdAngle members", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "DP_RINGAN" })).toBeInTheDocument(),
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
      expect(screen.getByRole("option", { name: angle })).toBeInTheDocument();
    }
  });

  it("previews the selected listing's real photos", async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    render(<PropertyManualBriefForm onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId("creative-photo-strip")).toBeInTheDocument());
    expect(screen.getAllByAltText("Foto listing")).toHaveLength(2);
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
});
