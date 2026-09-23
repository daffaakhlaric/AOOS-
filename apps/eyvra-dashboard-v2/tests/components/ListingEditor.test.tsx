import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ListingEditor } from "@/components/listings/ListingEditor";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps entered values when draft persistence fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: url.includes("config"),
      json: async () =>
        url.includes("config")
          ? { formats: [".xlsx", ".pdf"], maxBytes: 20971520 }
          : { message: "Penyimpanan tidak tersedia" },
    })),
  );
  render(<ListingEditor />);
  fireEvent.change(screen.getByLabelText("Judul Listing *"), { target: { value: "Rumah BSD" } });
  fireEvent.click(screen.getByRole("button", { name: "▣ Simpan Draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Penyimpanan tidak tersedia");
  expect(screen.getByLabelText("Judul Listing *")).toHaveValue("Rumah BSD");
});
it("creates an incomplete draft without inventing price or property type", async () => {
  const fetcher = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("config")
        ? { formats: [".xlsx"], maxBytes: 20971520 }
        : url.includes("knowledge")
          ? { documents: [], videos: [] }
          : { id: "draft-a", listingStatus: "DRAFT", photos: [] },
  }));
  vi.stubGlobal("fetch", fetcher);
  render(<ListingEditor />);
  fireEvent.change(screen.getByLabelText("Judul Listing *"), { target: { value: "Rumah BSD" } });
  fireEvent.click(screen.getByRole("button", { name: "▣ Simpan Draft" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Draft tersimpan"));
  expect(fetcher).toHaveBeenCalledWith(
    "/api/listing-editor/listings/drafts",
    expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Rumah BSD" }) }),
  );
});
it("shows source filename, sheet and row from analysis without invented promo copy", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.endsWith("analyze")
          ? {
              retrievalMode: "HYBRID",
              copy: { primaryText: "Rumah BSD", headline: "BSD", cta: null },
              sources: [
                {
                  documentId: "d",
                  fileName: "Price List.xlsx",
                  location: { sheet: "Type 120", rowStart: 12 },
                  excerpt: "Harga: Rp3,7M | Promo DP: 10%",
                },
              ],
              warnings: [],
              conflicts: [],
            }
          : url.includes("config")
            ? { formats: [".xlsx"], maxBytes: 20971520 }
            : url.includes("knowledge")
              ? { documents: [], videos: [] }
              : {
                  id: "a",
                  title: "Rumah BSD",
                  price: 3700000000,
                  listingStatus: "DRAFT",
                  photos: [],
                },
    })),
  );
  render(<ListingEditor listingId="a" />);
  await waitFor(() => expect(screen.getByLabelText("Judul Listing *")).toHaveValue("Rumah BSD"));
  fireEvent.click(screen.getByRole("button", { name: "✧ Analisa dengan Samantha" }));
  expect(await screen.findByText("Price List.xlsx → Sheet Type 120 → Row 12")).toBeInTheDocument();
});
