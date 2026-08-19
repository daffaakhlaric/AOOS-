import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadsClient } from "@/components/leads/LeadsClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("LeadsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every lead across branches", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        leads: [
          {
            id: "lead-1",
            leadPhone: "+6281200000001",
            leadName: "Pak Andi",
            branchId: "CINERE",
            status: "NEW",
            temperature: "HOT",
            score: 90,
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    ) as unknown as typeof fetch;

    render(<LeadsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
  });

  it("each row links to /leads/[id] (AAOS-CHAT-ROOM-JESSY)", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        leads: [
          {
            id: "lead-1",
            leadPhone: "+6281200000001",
            leadName: "Pak Andi",
            branchId: "CINERE",
            status: "NEW",
            temperature: "HOT",
            score: 90,
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    ) as unknown as typeof fetch;

    render(<LeadsClient />);
    await waitFor(() => expect(screen.getByText("Pak Andi")).toBeInTheDocument());
    expect(screen.getByText("Pak Andi").closest("a")).toHaveAttribute("href", "/leads/lead-1");
    expect(screen.getByText("Lihat Chat →")).toHaveAttribute("href", "/leads/lead-1");
  });

  it("shows an empty state when there are no leads", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ leads: [] })) as unknown as typeof fetch;
    render(<LeadsClient />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<LeadsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
