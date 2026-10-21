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
it("does not lose the picked file when the draft save it waits on is slow", async () => {
  // Regression test for a real race: `input.files` is a LIVE FileList tied to the input element —
  // real browsers clear it as a side effect of resetting `input.value` (needed so re-picking the
  // same file still fires another change event). `upload()` is async and only reads the file list
  // after `await persist()` resolves; real save logs showed persist() commonly taking 3s+, so by
  // the time it reads the list, a live reference would already be empty. jsdom's file input does
  // NOT reproduce that aliasing (verified: this exact scenario passes even against the unfixed
  // handler under jsdom), so this test reproduces the real hazard directly — mutating the input's
  // `.files` out from under the handler between the event and the awaited resolution — rather than
  // relying on jsdom to model browser-specific FileList behavior it doesn't implement.
  let resolveDraft: (() => void) | undefined;
  const draftGate = new Promise<void>((resolve) => {
    resolveDraft = resolve;
  });
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes("config"))
      return { ok: true, json: async () => ({ formats: [], maxBytes: 1 }) };
    if (url.includes("drafts")) {
      await draftGate; // held open until the test explicitly releases it, simulating the real delay
      return {
        ok: true,
        json: async () => ({ id: "draft-a", listingStatus: "DRAFT", photos: [] }),
      };
    }
    return { ok: true, json: async () => ({ documents: [], videos: [] }) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ListingEditor />);
  fireEvent.change(screen.getByLabelText("Judul Listing *"), { target: { value: "Rumah BSD" } });
  const file = new File(["x"], "photo.png", { type: "image/png" });
  const input: HTMLInputElement = screen
    .getByText("＋ Upload Foto")
    .closest("label")!
    .querySelector("input")!;
  fireEvent.change(input, { target: { files: [file] } });
  // Simulate the real browser's live-FileList aliasing: whatever reference the handler captured,
  // the DOM node's `.files` is now empty — same end state `e.target.value = ""` produces in Chrome.
  Object.defineProperty(input, "files", { value: [], configurable: true });
  resolveDraft!();
  expect(await screen.findByText("photo.png")).toBeInTheDocument();
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
