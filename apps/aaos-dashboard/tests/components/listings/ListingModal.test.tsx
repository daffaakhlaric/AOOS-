import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListingModal } from "@/components/listings/ListingModal";
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
  highlights: ["Dekat sekolah"],
  photos: [],
  documents: [],
  inKnowledgeBase: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ListingModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Add mode: shows a hint instead of the photo uploader until the listing is saved", () => {
    render(<ListingModal onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("+ Tambah Listing")).toBeInTheDocument();
    expect(screen.getByText("💾 Simpan Draft dulu untuk mulai menambah foto.")).toBeInTheDocument();
  });

  it("validates required fields before saving", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingModal onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByText("✓ Publish Listing"));
    expect(screen.getByText("Judul wajib diisi.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Add mode: POSTs the form and calls onSaved, unlocking the photo section", async () => {
    const onSaved = vi.fn();
    global.fetch = vi.fn(async () => jsonResponse({ listing: LISTING })) as unknown as typeof fetch;
    render(<ListingModal onClose={vi.fn()} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText("Judul *"), "Rumah Bintaro 88m²");
    await userEvent.type(screen.getByLabelText("Harga *"), "1800000000");
    await userEvent.click(screen.getByText("💾 Simpan Draft"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.getByText("Edit Listing")).toBeInTheDocument();
  });

  it("Edit mode: pre-fills fields and PUTs on save", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ listing: LISTING }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingModal editing={LISTING} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByDisplayValue("Rumah Bintaro 88m²")).toBeInTheDocument();
    await userEvent.click(screen.getByText("✓ Publish Listing"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/listings/listing-1");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("Edit mode with existing photos: renders the photo grid with a set-main toggle", () => {
    const withPhotos: ListingDto = {
      ...LISTING,
      photos: [
        { id: "p1", url: "https://gcs/1.jpg", order: 0, isMain: true },
        { id: "p2", url: "https://gcs/2.jpg", order: 1, isMain: false, label: "Ruang tamu" },
      ],
    };
    render(<ListingModal editing={withPhotos} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("⭐ Utama")).toBeInTheDocument();
    expect(screen.getByText("☆ Set Utama")).toBeInTheDocument();
  });

  it("Edit mode with existing documents: renders the document list with filename and size", () => {
    const withDocuments: ListingDto = {
      ...LISTING,
      documents: [
        {
          id: "d1",
          filename: "brosur.pdf",
          url: "https://gcs/brosur.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1_202_000,
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    render(<ListingModal editing={withDocuments} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("📄 brosur.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.1 MB")).toBeInTheDocument();
  });

  it("Edit mode with no documents: shows the empty-state hint", () => {
    render(<ListingModal editing={LISTING} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText("Belum ada dokumen.")).toBeInTheDocument();
  });

  it("deleting a document DELETEs the document endpoint and updates the listing", async () => {
    const withDocuments: ListingDto = {
      ...LISTING,
      documents: [
        {
          id: "d1",
          filename: "brosur.pdf",
          url: "https://gcs/brosur.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1000,
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ listing: LISTING }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ListingModal editing={withDocuments} onClose={vi.fn()} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByLabelText("Hapus dokumen"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/listings/listing-1/documents/d1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("calls onClose when Batal is clicked", async () => {
    const onClose = vi.fn();
    render(<ListingModal onClose={onClose} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByText("Batal"));
    expect(onClose).toHaveBeenCalled();
  });
});
