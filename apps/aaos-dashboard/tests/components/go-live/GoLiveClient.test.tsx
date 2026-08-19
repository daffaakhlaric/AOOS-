import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GoLiveClient } from "@/components/go-live/GoLiveClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("GoLiveClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always renders the empty state — there is no real 'LIVE' SimulationStatus to query for", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        history: [
          { id: "sim-1", status: "DONE", decision: "APPROVED", createdAt: "x", updatedAt: "x" },
          { id: "sim-2", status: "RUNNING", createdAt: "x", updatedAt: "x" },
          { id: "sim-3", status: "ERROR", createdAt: "x", updatedAt: "x" },
        ],
      }),
    ) as unknown as typeof fetch;

    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByText("Belum ada campaign live")).toBeInTheDocument());
    expect(screen.getByText("Mulai dari menu Simulasi.")).toBeInTheDocument();
  });

  it("renders a 4-cell KPI strip that all read 0/Rp 0", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ history: [] })) as unknown as typeof fetch;
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByTestId("go-live-kpi-strip")).toBeInTheDocument());
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("PAUSED")).toBeInTheDocument();
    expect(screen.getByText("TOTAL SPEND")).toBeInTheDocument();
    expect(screen.getByText("HOT LEADS HARI INI")).toBeInTheDocument();
    expect(screen.getByText("Rp 0")).toBeInTheDocument();
  });

  it("never renders Pause/Rollback/Detail buttons — there are never any campaign cards to attach them to", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ history: [] })) as unknown as typeof fetch;
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByTestId("go-live-kpi-strip")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<GoLiveClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
