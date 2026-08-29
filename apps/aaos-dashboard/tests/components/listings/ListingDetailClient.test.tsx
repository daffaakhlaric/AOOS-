import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { ListingDetailClient } from "@/components/listings/ListingDetailClient";
import type { ListingDto } from "@/types/listing.types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LISTING: ListingDto = {
  id: "listing-1",
  title: "Rumah Bintaro 88m²",
  propertyType: "RUMAH",
  listingStatus: "AKTIF",
  price: 1_800_000_000,
  bedrooms: 3,
  highlights: ["Dekat sekolah"],
  photos: [{ id: "p1", url: "https://gcs/1.jpg", order: 0, isMain: true }],
  mainPhotoUrl: "https://gcs/1.jpg",
  inKnowledgeBase: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ListingDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the listing's title, price, and specs", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ listing: LISTING })) as unknown as typeof fetch;
    render(<ListingDetailClient listingId="listing-1" />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    expect(screen.getByText("Rp 1.8 Miliar")).toBeInTheDocument();
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<ListingDetailClient listingId="listing-1" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("navigates to Kai's Creative Review with the listing id when 'Buat Creative' is clicked", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ listing: LISTING })) as unknown as typeof fetch;
    render(<ListingDetailClient listingId="listing-1" />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    await userEvent.click(screen.getByText("🎨 Buat Creative dengan Kai →"));
    expect(push).toHaveBeenCalledWith("/creative?listingId=listing-1");
  });

  it("publishes to Clara's knowledge base", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("publish-knowledge")) {
        return jsonResponse({ listing: { ...LISTING, inKnowledgeBase: true } });
      }
      return jsonResponse({ listing: LISTING });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingDetailClient listingId="listing-1" />);
    await waitFor(() =>
      expect(screen.getByText("📚 Jadikan Knowledge Samantha")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText("📚 Jadikan Knowledge Samantha"));
    await waitFor(() =>
      expect(screen.getByText("📚 Sudah di Knowledge Samantha")).toBeInTheDocument(),
    );
  });

  it("toggles listing status", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonResponse({ listing: { ...LISTING, listingStatus: "TERJUAL" } });
      }
      return jsonResponse({ listing: LISTING });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingDetailClient listingId="listing-1" />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "TERJUAL" }));
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit)?.method === "PUT",
      );
      expect(putCall).toBeDefined();
    });
  });
});
