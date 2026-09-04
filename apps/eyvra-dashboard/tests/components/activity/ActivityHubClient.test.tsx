import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const subscribeToActivityLog = vi.fn();

vi.mock("@/lib/realtime", () => ({
  subscribeToActivityLog: (...args: unknown[]) => subscribeToActivityLog(...args),
}));

import { ActivityHubClient } from "@/components/activity/ActivityHubClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const ACTIVITY_A = {
  id: "activity-1",
  loopId: "loop-1",
  agent: "SAMANTHA",
  actionType: "EXECUTE_VERDICT",
  mode: "LIVE",
  status: "SUCCESS",
  output: { action: "PAUSED" },
  reasoning: "Cost per lead melebihi threshold.",
  toolCalls: [{ tool: "metaAds.pauseAd", at: "2026-08-31T09:00:01.000Z" }],
  startedAt: "2026-08-31T09:00:00.000Z",
  completedAt: "2026-08-31T09:00:02.000Z",
  durationMs: 2000,
  createdAt: "2026-08-31T09:00:00.000Z",
};

const ACTIVITY_B = {
  id: "activity-2",
  loopId: "loop-1",
  agent: "CLARA",
  actionType: "SEND_FOLLOWUP",
  mode: "DEV",
  status: "SIMULATED",
  devPreview: { message: "Halo, jadi kapan survey lokasi?" },
  toolCalls: [],
  startedAt: "2026-08-31T09:01:00.000Z",
  createdAt: "2026-08-31T09:01:00.000Z",
};

const SETTINGS = {
  tenant: {
    tenantId: "dss-motor",
    name: "DSS Motor",
    vertical: "AUTOMOTIVE",
    status: "ACTIVE",
    mode: "LIVE",
  },
  meta: { apiVersion: "v21.0", hasToken: true, usingEnvDefault: false },
};

function mockFetch(activities: readonly unknown[] = [ACTIVITY_A, ACTIVITY_B]): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/activity-log")) {
      return jsonResponse({ activities, total: activities.length });
    }
    if (url.includes("/api/settings")) {
      return jsonResponse(SETTINGS);
    }
    return jsonResponse({}, 404);
  }) as unknown as typeof fetch;
}

describe("ActivityHubClient", () => {
  beforeEach(() => {
    subscribeToActivityLog.mockReset();
    subscribeToActivityLog.mockReturnValue({ unsubscribe: async () => "ok" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the real activity feed grouped into one Loop Run for the shared loopId", async () => {
    mockFetch();
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByTestId("activity-row-activity-1")).toBeInTheDocument());
    expect(screen.getByTestId("activity-row-activity-2")).toBeInTheDocument();
    expect(screen.getAllByTestId("loop-group")).toHaveLength(1);
    expect(screen.getByText("2 actions")).toBeInTheDocument();
  });

  it("shows the real DEV/LIVE mode badge from GET /api/settings", async () => {
    mockFetch();
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByTestId("mode-badge")).toHaveTextContent("LIVE"));
  });

  it("subscribes to the real activity-log realtime channel once the tenant id resolves", async () => {
    mockFetch();
    render(<ActivityHubClient />);
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

  it("clicking a row opens the real detail panel with Output/Reasoning/Tool Calls tabs", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByTestId("activity-row-activity-1")).toBeInTheDocument());
    await user.click(screen.getByTestId("activity-row-activity-1"));

    expect(screen.getByTestId("activity-detail-panel")).toBeInTheDocument();
    expect(screen.getByText("SAMANTHA — EXECUTE_VERDICT")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reasoning" }));
    expect(screen.getByText("Cost per lead melebihi threshold.")).toBeInTheDocument();
  });

  it("filtering by agent (Clara) hides the other agent's rows", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByTestId("activity-row-activity-1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "CLARA" }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("agent=CLARA")),
    );
  });

  it("free-text search filters the already-loaded real list client-side", async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByTestId("activity-row-activity-1")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Cari action..."), "FOLLOWUP");
    await waitFor(() => expect(screen.queryByText("EXECUTE_VERDICT")).not.toBeInTheDocument());
    expect(screen.getByText("SEND_FOLLOWUP")).toBeInTheDocument();
  });

  it("shows an empty state when there are no activities", async () => {
    mockFetch([]);
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByText("Belum ada aktivitas agent.")).toBeInTheDocument());
  });

  it("shows an error card when the fetch fails", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Gagal" } }, 500),
    ) as unknown as typeof fetch;
    render(<ActivityHubClient />);
    await waitFor(() => expect(screen.getByText("Gagal")).toBeInTheDocument());
  });
});
