import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ListingDetailPage } from "@/components/listing-detail/ListingDetailPage";
import { listingFixture } from "../lib/listing-fixture";
const { current } = vi.hoisted(() => ({ current: { tab: "overview" } }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ tab: current.tab }),
  useRouter: () => ({ push: vi.fn() }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  current.tab = "overview";
});
function mockData(role = "owner") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: !url.includes("listing-knowledge"),
      json: async () =>
        url === "/api/workspace"
          ? { role, vertical: "PROPERTY" }
          : url.includes("listing-knowledge")
            ? { message: "Knowledge offline" }
            : { ...listingFixture("a", "Rumah BSD"), campaigns: [], errors: [] },
    })),
  );
}
it("keeps the listing visible during knowledge failures and distinguishes unavailable metrics", async () => {
  mockData();
  render(<ListingDetailPage listingId="a" />);
  expect(await screen.findByRole("heading", { level: 1, name: "Rumah BSD" })).toBeInTheDocument();
  expect(screen.getAllByRole("tab")).toHaveLength(9);
  expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: /Dokumen/ })).toHaveAttribute(
    "href",
    "/listings/a?tab=documents",
  );
  expect(screen.getByText(/Metrik per listing belum terhubung/)).toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Knowledge sementara tidak tersedia");
});
it("restores media deep links and hides write actions from sales", async () => {
  current.tab = "media";
  mockData("sales");
  render(<ListingDetailPage listingId="a" />);
  await screen.findByRole("heading", { level: 1, name: "Rumah BSD" });
  expect(screen.getByRole("tab", { name: /Media/ })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("link", { name: /Edit Listing/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Upload Media/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Video" }));
  expect(screen.getByRole("button", { name: "Video" })).toHaveAttribute("aria-pressed", "true");
});
