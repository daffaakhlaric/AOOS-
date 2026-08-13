import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

import { ClosingListClient } from "@/components/closing/ClosingListClient";

describe("ClosingListClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when there are no closings this month", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ closings: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<ClosingListClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("renders a list of closings", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            closings: [
              {
                id: "c1",
                leadId: "lead-1",
                salesHumanId: "sales-rina",
                branchId: "CINERE",
                closingType: "SPK",
                unitModel: "Xpander",
                commissionIdr: 1_000_000,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<ClosingListClient />);
    await waitFor(() => expect(screen.getAllByTestId("closing-card")).toHaveLength(1));
  });

  it("shows an error card when the fetch fails", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<ClosingListClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
