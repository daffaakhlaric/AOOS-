import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ClaraAnalyticsClient } from "@/components/clara/ClaraAnalyticsClient";
import type { LeadsAnalyticsDto } from "@/types/dashboard.types";

// Tremor's chart components render Recharts' `ResponsiveContainer`, which observes its container
// via `ResizeObserver` — not implemented in jsdom. A minimal no-op stub is enough for the charts
// to mount without throwing; this test asserts on the real KPI/period-selector DOM, not chart
// internals (recharts renders 0x0 in jsdom regardless of a real observer).
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const ANALYTICS: LeadsAnalyticsDto = {
  periodDays: 7,
  totalContacts: 42,
  newContacts: 5,
  active: 12,
  avgResponseTimeMinutes: 8.4,
  avgFirstResponseTimeMinutes: 3.1,
  dailySeries: [
    { date: "2026-08-13", newContacts: 1, totalContacts: 40 },
    { date: "2026-08-14", newContacts: 2, totalContacts: 42 },
  ],
};

describe("ClaraAnalyticsClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the 5-cell KPI strip with real values from GET /api/clara/analytics", async () => {
    global.fetch = vi.fn(async () => jsonResponse(ANALYTICS)) as unknown as typeof fetch;
    render(<ClaraAnalyticsClient />);
    await waitFor(() => expect(screen.getByTestId("analytics-kpi-strip")).toBeInTheDocument());
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("TOTAL CONTACTS")).toBeInTheDocument();
    expect(screen.getByText("NEW CONTACTS")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("RESPONSE TIME")).toBeInTheDocument();
    expect(screen.getByText("FIRST RESP TIME")).toBeInTheDocument();
  });

  it("re-fetches with the new days param when the period selector changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      expect(url).toContain("/api/clara/analytics?days=");
      return jsonResponse(ANALYTICS);
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ClaraAnalyticsClient />);
    await waitFor(() => expect(screen.getByTestId("analytics-kpi-strip")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Periode"), { target: { value: "30" } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/clara/analytics?days=30"));
  });

  it("shows a dash (never a fabricated number) when a response-time average is null", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        ...ANALYTICS,
        avgResponseTimeMinutes: null,
        avgFirstResponseTimeMinutes: null,
      }),
    ) as unknown as typeof fetch;
    render(<ClaraAnalyticsClient />);
    await waitFor(() => expect(screen.getByTestId("analytics-kpi-strip")).toBeInTheDocument());
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    render(<ClaraAnalyticsClient />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
  });
});
