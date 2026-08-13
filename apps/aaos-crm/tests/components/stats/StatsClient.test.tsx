import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

import { StatsClient } from "@/components/stats/StatsClient";

describe("StatsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the 4 stat tiles once stats load", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leadsToday: 3,
            testDriveThisMonth: 5,
            spkThisMonth: 2,
            commissionThisMonthIdr: 11_700_000,
            recentClosings: [],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<StatsClient />);
    await waitFor(() => expect(screen.getByTestId("personal-stats-card")).toBeInTheDocument());
  });

  it("renders recent closings", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leadsToday: 0,
            testDriveThisMonth: 0,
            spkThisMonth: 0,
            commissionThisMonthIdr: 0,
            recentClosings: [
              {
                id: "c1",
                leadId: "lead-1",
                salesHumanId: "sales-rina",
                branchId: "CINERE",
                closingType: "SPK",
                unitModel: "Xpander",
                commissionIdr: 5_850_000,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<StatsClient />);
    await waitFor(() => expect(screen.getByTestId("recent-closings-list")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<StatsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
