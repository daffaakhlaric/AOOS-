import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ObjectiveStripCard } from "@/components/campaigns/ObjectiveStripCard";

function mockFetch(routes: Record<string, unknown>): void {
  global.fetch = vi.fn(async (url: string) => {
    const body = routes[url];
    if (body === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("ObjectiveStripCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("AUTOMOTIVE tenant: loads /api/objective and shows the real target", async () => {
    mockFetch({
      "/api/settings": { tenant: { vertical: "AUTOMOTIVE" } },
      "/api/objective": { objective: { targetHotLeads: 40 } },
      "/api/overview": {
        leads: { hot: 10, warm: 0, cold: 0, hotToday: 0, hotYesterday: 0, hotDeltaVsYesterday: 0 },
      },
    });
    render(<ObjectiveStripCard />);
    await waitFor(() =>
      expect(screen.getByTestId("objective-strip-card")).toHaveTextContent("40 HOT leads"),
    );
    expect(screen.getByTestId("objective-strip-card")).toHaveTextContent("10");
  });

  it("PROPERTY tenant: loads /api/property-objective and reports the real targetCpl business-context number upward", async () => {
    const onTargetCplResolved = vi.fn();
    mockFetch({
      "/api/settings": { tenant: { vertical: "PROPERTY" } },
      "/api/property-objective": { objective: { targetHotLeads: 20, targetCpl: 175_000 } },
      "/api/overview": {
        leads: { hot: 5, warm: 0, cold: 0, hotToday: 0, hotYesterday: 0, hotDeltaVsYesterday: 0 },
      },
    });
    render(<ObjectiveStripCard onTargetCplResolved={onTargetCplResolved} />);
    await waitFor(() => expect(onTargetCplResolved).toHaveBeenCalledWith(175_000));
  });

  it("reports null (never a fabricated benchmark) when no real objective exists yet", async () => {
    const onTargetCplResolved = vi.fn();
    mockFetch({
      "/api/settings": { tenant: { vertical: "PROPERTY" } },
      "/api/property-objective": { objective: null },
    });
    render(<ObjectiveStripCard onTargetCplResolved={onTargetCplResolved} />);
    await waitFor(() => expect(screen.getByText("Belum ada objective")).toBeInTheDocument());
    expect(onTargetCplResolved).not.toHaveBeenCalledWith(expect.any(Number));
  });

  // Campaign Page Rebuild v2 (Prompt 4) — real projected end-of-month estimate.
  it("shows a real, explicitly-labeled projected end-of-month estimate using real elapsed/total day pace math", async () => {
    // Day 10 of a 30-day month, achieved=10 -> projected = 10/10*30 = 30.
    mockFetch({
      "/api/settings": { tenant: { vertical: "AUTOMOTIVE" } },
      "/api/objective": { objective: { targetHotLeads: 40 } },
      "/api/overview": {
        leads: { hot: 10, warm: 0, cold: 0, hotToday: 0, hotYesterday: 0, hotDeltaVsYesterday: 0 },
      },
    });
    render(<ObjectiveStripCard now={new Date(Date.UTC(2026, 8, 10))} />);
    await waitFor(() => expect(screen.getByTestId("objective-projection")).toHaveTextContent("30"));
    expect(screen.getByTestId("objective-projection")).toHaveTextContent("estimasi");
  });

  // Campaign Page Rebuild v2 (Prompt 4) — real per-campaign HOT-lead breakdown.
  it("groups real HOT leads by their real campaignId, using the real campaign name when known", async () => {
    mockFetch({
      "/api/settings": { tenant: { vertical: "AUTOMOTIVE" } },
      "/api/objective": { objective: { targetHotLeads: 40 } },
      "/api/overview": {
        leads: { hot: 3, warm: 0, cold: 0, hotToday: 0, hotYesterday: 0, hotDeltaVsYesterday: 0 },
      },
      "/api/leads": {
        leads: [
          {
            id: "l1",
            leadPhone: "1",
            status: "OPEN",
            temperature: "HOT",
            score: 1,
            createdAt: "",
            branchId: "BINTARO",
            campaignId: "c1",
          },
          {
            id: "l2",
            leadPhone: "2",
            status: "OPEN",
            temperature: "HOT",
            score: 1,
            createdAt: "",
            branchId: "BINTARO",
            campaignId: "c1",
          },
          {
            id: "l3",
            leadPhone: "3",
            status: "OPEN",
            temperature: "COLD",
            score: 1,
            createdAt: "",
            branchId: "BINTARO",
            campaignId: "c1",
          },
          {
            id: "l4",
            leadPhone: "4",
            status: "OPEN",
            temperature: "HOT",
            score: 1,
            createdAt: "",
            branchId: "BINTARO",
          },
        ],
      },
    });
    render(<ObjectiveStripCard campaigns={[{ id: "c1", name: "Kavling BSD" }]} now={new Date()} />);
    await waitFor(() =>
      expect(screen.getByTestId("objective-hot-lead-breakdown")).toBeInTheDocument(),
    );
    const breakdown = screen.getByTestId("objective-hot-lead-breakdown");
    expect(breakdown).toHaveTextContent("Kavling BSD");
    expect(breakdown).toHaveTextContent("Tanpa campaign");
  });
});
