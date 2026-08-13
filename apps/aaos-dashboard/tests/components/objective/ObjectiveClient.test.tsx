import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ObjectiveClient } from "@/components/objective/ObjectiveClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ObjectiveClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the ObjectiveCard once an objective is loaded", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        objective: {
          id: "obj-1",
          tenantId: "dss-motor",
          period: { month: 8, year: 2026 },
          targetHotLeads: 50,
          budgetAllocation: 30_000_000,
          focusUnits: ["Xpander"],
          areaPriorities: ["BINTARO"],
          status: "DRAFT",
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      }),
    ) as unknown as typeof fetch;

    render(<ObjectiveClient />);
    await waitFor(() => expect(screen.getByTestId("objective-card")).toBeInTheDocument());
  });

  it("renders only the form when there is no current objective", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ objective: null })) as unknown as typeof fetch;
    render(<ObjectiveClient />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Set Objective/ })).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("objective-card")).not.toBeInTheDocument();
  });

  it("submits the form and shows the newly created objective", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({
          objective: {
            id: "obj-2",
            tenantId: "dss-motor",
            period: { month: 8, year: 2026 },
            targetHotLeads: 50,
            budgetAllocation: 30_000_000,
            focusUnits: ["Xpander", "Brio"],
            areaPriorities: ["BINTARO"],
            status: "DRAFT",
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        });
      }
      return jsonResponse({ objective: null });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ObjectiveClient />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Set Objective/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    await waitFor(() => expect(screen.getByTestId("objective-card")).toBeInTheDocument());
  });

  it("shows an error card when the POST fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        return jsonResponse({ error: { message: "gagal" } }, 422);
      }
      return jsonResponse({ objective: null });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ObjectiveClient />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Set Objective/ })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /Set Objective/ }));
    await waitFor(() => expect(screen.getByText("gagal")).toBeInTheDocument());
  });
});
