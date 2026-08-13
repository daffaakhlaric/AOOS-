import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSalesSession = vi.fn();
vi.mock("@/lib/session", () => ({ useSalesSession: () => useSalesSession() }));

import { MyLeadsClient } from "@/components/leads/MyLeadsClient";

describe("MyLeadsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when there are no assigned leads", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ leads: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    render(<MyLeadsClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("renders a list of assigned leads with Detail + Input Closing links", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leads: [
              {
                id: "lead-1",
                leadPhone: "+6281234567890",
                leadName: "Pak Budi",
                branchId: "CINERE",
                status: "ASSIGNED",
                temperature: "HOT",
                score: 70,
                qualification: {
                  budget: true,
                  unit: true,
                  area: true,
                  payment: true,
                  timeline: true,
                  name: true,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<MyLeadsClient />);
    await waitFor(() => expect(screen.getByText("Pak Budi")).toBeInTheDocument());
    expect(screen.getByText("Detail")).toHaveAttribute("href", "/leads/lead-1");
    expect(screen.getByText("Input Closing")).toHaveAttribute("href", "/closing/new?leadId=lead-1");
  });

  it("shows the active count excluding CLOSED leads", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leads: [
              {
                id: "l1",
                leadPhone: "+621",
                branchId: "CINERE",
                status: "ASSIGNED",
                temperature: "HOT",
                score: 1,
                qualification: {
                  budget: true,
                  unit: true,
                  area: true,
                  payment: true,
                  timeline: true,
                  name: true,
                },
                createdAt: "x",
                updatedAt: "x",
              },
              {
                id: "l2",
                leadPhone: "+622",
                branchId: "CINERE",
                status: "CLOSED",
                temperature: "HOT",
                score: 1,
                qualification: {
                  budget: true,
                  unit: true,
                  area: true,
                  payment: true,
                  timeline: true,
                  name: true,
                },
                createdAt: "x",
                updatedAt: "x",
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    render(<MyLeadsClient />);
    await waitFor(() => expect(screen.getByText("1 aktif")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    useSalesSession.mockReturnValue({ session: { salesHumanId: "sales-rina" }, loading: false });
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    render(<MyLeadsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
