import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreativeLogList } from "@/components/creative/CreativeLogList";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const LOGS = [
  {
    id: "log-1",
    packageId: "pkg-1",
    fromAgent: "TAMARA",
    toAgent: "KAI",
    eventType: "BRIEF_SENT",
    message: "Brief DP_RINGAN untuk Xpander GLS 2022 (CINERE) dikirim ke Kai.",
    brief: { unit: "xpander-gls-2022-001", angle: "DP_RINGAN" },
    stableId: "C047",
    createdAt: "2026-08-18T02:41:00.000Z",
  },
  {
    id: "log-2",
    packageId: "pkg-1",
    fromAgent: "KIE_AI",
    toAgent: "KAI",
    eventType: "ERROR",
    message: "Generate gagal: Kie AI timeout after 15 minutes",
    error: "Kie AI timeout after 15 minutes",
    createdAt: "2026-08-18T02:56:00.000Z",
  },
];

describe("CreativeLogList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real log entries returned by the API", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ logs: LOGS })) as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getAllByTestId("creative-log-entry")).toHaveLength(2));
    expect(screen.getByText(/TAMARA → KAI/)).toBeInTheDocument();
    expect(screen.getAllByText(/Kie AI timeout after 15 minutes/).length).toBeGreaterThan(0);
  });

  it("shows an empty state rather than inventing log lines", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ logs: [] })) as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    expect(screen.queryByTestId("creative-log-entry")).not.toBeInTheDocument();
  });

  it("filters by a REAL event type via the API, not client-side", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ logs: LOGS }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getAllByTestId("creative-log-entry")).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Error" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes("eventType=ERROR")),
      ).toBe(true),
    );
  });

  it("changes the period bound through the API's sinceHours parameter", async () => {
    const fetchMock = vi.fn(async (_input: string | URL, _init?: RequestInit) =>
      jsonResponse({ logs: [] }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getByTestId("empty-state")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Hari ini" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes("sinceHours=24"))).toBe(
        true,
      ),
    );
  });

  it("shows an error card when the log fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });

  it("expands the real persisted brief JSON on demand", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ logs: LOGS })) as unknown as typeof fetch;
    render(<CreativeLogList />);
    await waitFor(() => expect(screen.getAllByTestId("creative-log-entry")).toHaveLength(2));
    expect(screen.getByText("Lihat brief lengkap")).toBeInTheDocument();
    expect(screen.getByText(/xpander-gls-2022-001/)).toBeInTheDocument();
  });
});
