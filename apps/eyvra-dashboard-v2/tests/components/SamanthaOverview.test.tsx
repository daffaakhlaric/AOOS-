import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { SamanthaOverview } from "@/components/samantha/SamanthaOverview";
vi.mock("next/navigation", () => ({ usePathname: () => "/samantha" }));
const campaign = {
  id: "a",
  metaId: "a",
  stableId: "a",
  name: "Real Campaign",
  objective: "OUTCOME_LEADS",
  status: "ACTIVE",
  spend: 0,
  dailyBudget: 0,
  accountId: "act",
  accountName: "Real Account",
  syncedAt: "2026-10-01",
  adSets: [],
};
afterEach(() => vi.unstubAllGlobals());
describe("Samantha Overview", () => {
  it("keeps campaign data when diagnosis fails and never invents an action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.includes("account-summary"),
        json: async () =>
          url.includes("/api/campaigns")
            ? { campaigns: [campaign], errors: [] }
            : url.includes("account-summary")
              ? { error: { message: "Diagnosis unavailable" } }
              : url.includes("/reviews")
                ? []
                : url.includes("/creative")
                  ? { packages: [] }
                  : { leads: { hot: 0 }, errors: {} },
      })),
    );
    render(<SamanthaOverview />);
    expect(await screen.findByText("Real Campaign")).toBeInTheDocument();
    expect(screen.getAllByText("Diagnosis unavailable").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Jalankan sekarang" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cari campaign"), { target: { value: "absent" } });
    expect(screen.getByText(/Tidak ada campaign yang sesuai/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Periode performa"), { target: { value: "last_30d" } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/campaigns?period=last_30d", expect.anything()),
    );
  });
  it("offers campaign creation when the actual portfolio is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("/api/campaigns")
            ? { campaigns: [], errors: [] }
            : url.includes("account-summary")
              ? { campaigns: [], opportunities: [], errors: {}, generatedAt: "2026-10-01" }
              : url.includes("/reviews")
                ? []
                : url.includes("/creative")
                  ? { packages: [] }
                  : { errors: {} },
      })),
    );
    render(<SamanthaOverview />);
    expect(await screen.findByRole("link", { name: "Buat campaign" })).toHaveAttribute(
      "href",
      "/campaigns/new",
    );
    expect(screen.getByText(/Belum ada keputusan untuk filter ini/)).toBeInTheDocument();
  });
});
