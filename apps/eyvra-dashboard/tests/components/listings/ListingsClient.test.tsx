import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListingsClient } from "@/components/listings/ListingsClient";

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
  photos: [{ id: "p1", url: "https://gcs/1.jpg", order: 0, isMain: true }],
  mainPhotoUrl: "https://gcs/1.jpg",
  inKnowledgeBase: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ListingsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the KPI strip and listing cards", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ listings: [LISTING], total: 1 }),
    ) as unknown as typeof fetch;
    render(<ListingsClient />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    expect(screen.getByTestId("listing-kpi")).toBeInTheDocument();
    expect(screen.getByText("Rp 1.8 Miliar")).toBeInTheDocument();
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "boom" } }, 500),
    ) as unknown as typeof fetch;
    render(<ListingsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("shows the empty state when there are no listings", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ listings: [], total: 0 }),
    ) as unknown as typeof fetch;
    render(<ListingsClient />);
    await waitFor(() => expect(screen.getByText("Belum ada listing.")).toBeInTheDocument());
  });

  it("opens the Add Listing modal", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ listings: [LISTING], total: 1 }),
    ) as unknown as typeof fetch;
    render(<ListingsClient />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    await userEvent.click(screen.getByText("+ Tambah Listing"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("refetches with a status filter when the select changes", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ listings: [LISTING], total: 1 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingsClient />);
    await waitFor(() => expect(screen.getByText("Rumah Bintaro 88m²")).toBeInTheDocument());
    await userEvent.selectOptions(screen.getByDisplayValue("Semua"), "AKTIF");
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain("status=AKTIF");
    });
  });
});
