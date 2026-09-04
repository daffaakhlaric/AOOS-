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
    // Mount itself fires a real GET /api/region/provinces fetch for the cascading picker — record
    // the call count here rather than asserting zero calls overall.
    const callsBeforeClick = fetchMock.mock.calls.length;
    await userEvent.click(screen.getByText("✓ Publish Listing"));
    expect(screen.getByText("Judul wajib diisi.")).toBeInTheDocument();
    expect(fetchMock.mock.calls).toHaveLength(callsBeforeClick);
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
    // The mount also fires a real GET /api/region/provinces fetch for the cascading picker (see
    // ListingModal.tsx's region-cascading useEffect) — find the real PUT call among all calls
    // rather than assuming index 0, same real "fetch is called more than once now" adjustment
    // every other index-0-assuming test in this file needed after the region picker landed.
    const putCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "PUT",
    );
    expect(putCall).toBeDefined();
    const [url, init] = putCall!;
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
    // Same "mount also fires a region-provinces GET" adjustment as the PUT test above.
    const deleteCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    const [url, init] = deleteCall!;
    expect(url).toBe("/api/listings/listing-1/documents/d1");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("calls onClose when Batal is clicked", async () => {
    const onClose = vi.fn();
    render(<ListingModal onClose={onClose} onSaved={vi.fn()} />);
    await userEvent.click(screen.getByText("Batal"));
    expect(onClose).toHaveBeenCalled();
  });

  describe("real cascading province -> kota/kabupaten -> kecamatan picker", () => {
    function regionFetchMock(): ReturnType<typeof vi.fn> {
      return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/region/provinces")) {
          return jsonResponse({ items: [{ id: "11", nama: "Aceh" }] });
        }
        if (url.includes("/api/region/regencies/11")) {
          return jsonResponse({ items: [{ id: "1101", nama: "Kabupaten Aceh Selatan" }] });
        }
        if (url.includes("/api/region/districts/1101")) {
          return jsonResponse({ items: [{ id: "110101", nama: "Bakongan" }] });
        }
        return jsonResponse({ listing: LISTING });
      });
    }

    it("populates the province select on mount; picking a province enables and populates the city select; picking a city enables and populates the kecamatan select", async () => {
      global.fetch = regionFetchMock() as unknown as typeof fetch;
      render(<ListingModal onClose={vi.fn()} onSaved={vi.fn()} />);

      await waitFor(() => expect(screen.getByRole("option", { name: "Aceh" })).toBeInTheDocument());

      const citySelect = screen.getByLabelText("Kota/Kab") as HTMLSelectElement;
      const kecamatanSelect = screen.getByLabelText("Kecamatan") as HTMLSelectElement;
      expect(citySelect.disabled).toBe(true);
      expect(kecamatanSelect.disabled).toBe(true);

      await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "11");
      await waitFor(() => expect(citySelect.disabled).toBe(false));
      await waitFor(() =>
        expect(screen.getByRole("option", { name: "Kabupaten Aceh Selatan" })).toBeInTheDocument(),
      );

      await userEvent.selectOptions(citySelect, "1101");
      await waitFor(() => expect(kecamatanSelect.disabled).toBe(false));
      await waitFor(() =>
        expect(screen.getByRole("option", { name: "Bakongan" })).toBeInTheDocument(),
      );

      await userEvent.selectOptions(kecamatanSelect, "110101");
      expect(kecamatanSelect.value).toBe("110101");
    });

    it("an existing listing whose free-text city/province don't match any real wilayah option still loads and edits fine — the selects stay unset with an informational hint, never a crash", async () => {
      const legacyListing: ListingDto = {
        ...LISTING,
        province: "Provinsi Buatan Sendiri",
        city: "Kota Bebas Teks",
      };
      global.fetch = regionFetchMock() as unknown as typeof fetch;
      render(<ListingModal editing={legacyListing} onClose={vi.fn()} onSaved={vi.fn()} />);

      // The listing renders immediately (edit mode), unaffected by the region fetch outcome.
      expect(screen.getByText("Edit Listing")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Rumah Bintaro 88m²")).toBeInTheDocument();

      await waitFor(() => expect(screen.getByRole("option", { name: "Aceh" })).toBeInTheDocument());

      const provinceSelect = screen.getByLabelText("Provinsi") as HTMLSelectElement;
      expect(provinceSelect.value).toBe(""); // no real province named "Provinsi Buatan Sendiri"
      expect(
        screen.getByText(
          'Nilai saat ini: "Provinsi Buatan Sendiri" (tidak cocok data wilayah, pilih ulang jika perlu)',
        ),
      ).toBeInTheDocument();
    });

    it("real, honest degrade: a region fetch failure never blocks editing the rest of the form", async () => {
      global.fetch = vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch;
      render(<ListingModal editing={LISTING} onClose={vi.fn()} onSaved={vi.fn()} />);
      await waitFor(() =>
        expect(
          screen.getByText("Gagal memuat data wilayah — provinsi bisa diisi ulang nanti."),
        ).toBeInTheDocument(),
      );
      expect(screen.getByDisplayValue("Rumah Bintaro 88m²")).toBeInTheDocument();
    });
  });
});
