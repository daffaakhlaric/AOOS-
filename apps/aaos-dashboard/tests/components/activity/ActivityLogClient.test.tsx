import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeToActivityLog = vi.fn();

vi.mock("@/lib/realtime", () => ({
  subscribeToActivityLog: (...args: unknown[]) => subscribeToActivityLog(...args),
}));

import { ActivityLogClient } from "@/components/activity/ActivityLogClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const ACTIVITY = {
  id: "activity-1",
  loopId: "corr-1",
  agent: "SAMANTHA",
  actionType: "EXECUTE_VERDICT",
  mode: "LIVE",
  status: "SUCCESS",
  output: { action: "PAUSED" },
  toolCalls: [],
  startedAt: "2026-08-31T09:00:00.000Z",
  completedAt: "2026-08-31T09:00:02.000Z",
  durationMs: 2000,
  createdAt: "2026-08-31T09:00:00.000Z",
};

const SETTINGS = {
  tenant: { tenantId: "dss-motor", name: "DSS Motor", vertical: "AUTOMOTIVE", status: "ACTIVE" },
  meta: { apiVersion: "v21.0", hasToken: true, usingEnvDefault: false },
};

function mockFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/activity-log")) {
      return jsonResponse({ activities: [ACTIVITY], total: 1 });
    }
    if (url.includes("/api/settings")) {
      return jsonResponse(SETTINGS);
    }
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
}

describe("ActivityLogClient", () => {
  beforeEach(() => {
    subscribeToActivityLog.mockReset();
    subscribeToActivityLog.mockReturnValue({ unsubscribe: async () => "ok" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the activity list from GET /api/activity-log", async () => {
    mockFetch();
    render(<ActivityLogClient />);
    await waitFor(() => expect(screen.getByText("SAMANTHA")).toBeInTheDocument());
    expect(screen.getByText("EXECUTE_VERDICT")).toBeInTheDocument();
    const row = screen.getByTestId("activity-list");
    expect(within(row).getByText("SUCCESS")).toBeInTheDocument();
  });

  it("subscribes to the real activity-log realtime channel once the tenant id resolves", async () => {
    mockFetch();
    render(<ActivityLogClient />);
    await waitFor(() =>
      expect(subscribeToActivityLog).toHaveBeenCalledWith(
        "dss-motor",
        expect.objectContaining({
          onNewActivity: expect.any(Function),
          onActivityUpdated: expect.any(Function),
        }),
      ),
    );
  });

  it("opens the detail drawer with the 4 real tabs when a row is clicked", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<ActivityLogClient />);
    await waitFor(() => expect(screen.getByText("SAMANTHA")).toBeInTheDocument());
    await user.click(screen.getByText("SAMANTHA"));

    expect(screen.getByRole("dialog", { name: "Activity detail" })).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Reasoning")).toBeInTheDocument();
    expect(screen.getByText("Tool Calls")).toBeInTheDocument();
    expect(screen.getByText("Raw JSON")).toBeInTheDocument();
  });

  it("shows an empty state when there are no activities", async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/activity-log")) {
        return jsonResponse({ activities: [], total: 0 });
      }
      return jsonResponse(SETTINGS);
    }) as unknown as typeof fetch;
    render(<ActivityLogClient />);
    await waitFor(() => expect(screen.getByText("Belum ada aktivitas agent.")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Gagal" } }, 500),
    ) as unknown as typeof fetch;
    render(<ActivityLogClient />);
    await waitFor(() => expect(screen.getByText("Gagal")).toBeInTheDocument());
  });
});
