import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ListingsPage } from "@/components/listings/ListingsPage";
import { listingFixture } from "../lib/listing-fixture";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("selects a property and updates connected copy without claiming applied targeting", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("growth-objectives")
          ? { objectives: [] }
          : url.includes("creative")
            ? { packages: [] }
            : {
                listings: [listingFixture("a", "Listing A"), listingFixture("b", "Listing B")],
                total: 2,
                campaigns: [],
                errors: [],
              },
    })),
  );
  render(<ListingsPage />);
  await screen.findByRole("button", { name: "Analisis Listing B" });
  fireEvent.click(screen.getByRole("button", { name: "Analisis Listing B" }));
  expect(screen.getByRole("button", { name: "Analisis Listing B" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getAllByText("Belum divalidasi untuk konfigurasi Meta ini")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Launch with Samantha" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Cari listing" }), {
    target: { value: "does not exist" },
  });
  expect(screen.getByText("Tidak ada listing sesuai filter.")).toBeInTheDocument();
});
it("keeps API errors distinct from a real empty listing collection", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<ListingsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Listing data unavailable");
  expect(screen.queryByText("Belum ada listing.")).not.toBeInTheDocument();
});
