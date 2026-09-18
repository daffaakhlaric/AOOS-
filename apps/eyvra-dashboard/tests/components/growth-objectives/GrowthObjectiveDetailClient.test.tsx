import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GrowthObjectiveDetailClient } from "@/components/growth-objectives/GrowthObjectiveDetailClient";

interface Route {
  readonly method?: string;
  readonly body: unknown;
  readonly status?: number;
}

function mockFetch(routes: Record<string, Route | readonly Route[]>): {
  readonly fetchMock: ReturnType<typeof vi.fn>;
} {
  const cursors = new Map<string, number>();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const matchingKeys = Object.keys(routes).filter((key) => url === key || url.startsWith(key));
    // Prefer the most specific (longest) key — e.g. ".../go-1/pacing" over ".../go-1" — so a
    // shorter prefix key never shadows a real, more specific sibling route.
    const matchKey = matchingKeys.sort((a, b) => b.length - a.length)[0];
    if (matchKey === undefined) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    const entry = routes[matchKey];
    const list = Array.isArray(entry) ? entry : [entry];
    const candidates = list.filter((route) => (route.method ?? "GET") === method);
    if (candidates.length === 0) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    const cursorKey = `${matchKey}:${method}`;
    const index = cursors.get(cursorKey) ?? 0;
    const route = candidates[Math.min(index, candidates.length - 1)] as Route;
    cursors.set(cursorKey, index + 1);
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock };
}

const BASE_OBJECTIVE = {
  id: "go-1",
  tenantId: "tenant-1",
  metric: "HOT_LEADS",
  targetValue: 50,
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  budgetMode: "GOAL_FIRST",
  focusListingIds: [],
  areaStrategy: "SAMANTHA",
  manualAreas: [],
  automationMode: "ADVISOR",
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const REVERSE_FUNNEL = {
  conversionRate: 0.4,
  estimatedRequiredRawLeads: { min: 100, expected: 125, max: 150 },
  estimatedMediaSpendIdr: { min: 10_000_000, expected: 12_500_000, max: 15_000_000 },
  confidence: 0.8,
};

const FEASIBILITY = {
  status: "ACHIEVABLE",
  confidence: 0.8,
  reasons: ["Kebutuhan pace 4.0 raw lead/hari masih jauh di bawah kapasitas saat ini."],
  options: [],
};

const PROGRESS = {
  status: "ON_TRACK",
  progressPct: 0.6,
  daysElapsed: 10,
  daysRemaining: 20,
  currentDailyPace: 3,
  requiredDailyPace: 1,
  projectedFinalCount: 93,
};

const PACING_RESPONSE = {
  objectiveId: "go-1",
  pacing: {
    status: "ON_PACE",
    expectedSpendToDateIdr: 4_000_000,
    actualSpendIdr: 4_200_000,
    pacingPct: 1.05,
    daysRemaining: 20,
    daysElapsed: 10,
    requiredDailyPaceIdr: 400_000,
    projectedEndOfPeriodSpendIdr: 12_600_000,
  },
  spendSource: "MATCHED_CAMPAIGNS",
};

function noPacing(): Route {
  return { body: {}, status: 404 };
}

describe("GrowthObjectiveDetailClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading spinner before the fetch resolves", () => {
    global.fetch = vi.fn(() => new Promise(() => undefined)) as unknown as typeof fetch;
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows an error card when the objective fetch fails", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1": { body: { error: { message: "boom" } }, status: 500 },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("error-card")).toBeInTheDocument());
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows honest absent-forecast, absent-progress and absent-pacing states", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1": { body: BASE_OBJECTIVE },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument());

    expect(screen.getByTestId("forecast-empty")).toHaveTextContent(
      "Belum pernah dianalisa — klik Analisa untuk menghitung forecast.",
    );
    expect(screen.getByTestId("progress-empty")).toHaveTextContent(
      "Belum pernah dicek progressnya.",
    );
    expect(screen.getByTestId("pacing-empty")).toBeInTheDocument();
  });

  it("renders forecast, progress and pacing fully when all are present", async () => {
    const populated = {
      ...BASE_OBJECTIVE,
      status: "ON_TRACK",
      forecast: { reverseFunnel: REVERSE_FUNNEL, feasibility: FEASIBILITY },
      progress: PROGRESS,
    };
    mockFetch({
      "/api/growth-objectives/go-1/pacing": { body: PACING_RESPONSE },
      "/api/growth-objectives/go-1": { body: populated },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument());

    // Forecast — reverse funnel
    await waitFor(() => expect(screen.getByTestId("reverse-funnel-block")).toBeInTheDocument());
    expect(screen.getByTestId("reverse-funnel-block")).toHaveTextContent("40%");
    expect(screen.getByTestId("reverse-funnel-block")).toHaveTextContent(/Rp\s?10\.000\.000/);

    // Forecast — feasibility
    expect(screen.getByTestId("feasibility-status-badge")).toHaveTextContent("Achievable");
    expect(screen.getByTestId("feasibility-reasons")).toHaveTextContent(
      "Kebutuhan pace 4.0 raw lead/hari",
    );

    // Progress
    expect(screen.getByTestId("progress-status-badge")).toHaveTextContent("On Track");
    expect(screen.getByTestId("progress-body")).toHaveTextContent("60%");

    // Pacing
    await waitFor(() => expect(screen.getByTestId("pacing-body")).toBeInTheDocument());
    expect(screen.getByTestId("pacing-status-badge")).toHaveTextContent("On Pace");
    expect(screen.getByTestId("pacing-spend-source")).toHaveTextContent(
      "Campaign yang cocok dengan objective ini",
    );
  });

  it("shows only the Analisa button for a DRAFT objective", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status: "DRAFT" } },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument());

    expect(screen.getByTestId("action-analyze-button")).toBeInTheDocument();
    expect(screen.queryByTestId("action-activate-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-check-progress-button")).not.toBeInTheDocument();
  });

  it("shows only the Aktifkan button for a PLANNED objective", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status: "PLANNED" } },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument());

    expect(screen.queryByTestId("action-analyze-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-activate-button")).toBeInTheDocument();
    expect(screen.queryByTestId("action-check-progress-button")).not.toBeInTheDocument();
  });

  it("shows only the Cek Progress button for ACTIVE/ON_TRACK/AT_RISK/OFF_TRACK objectives", async () => {
    for (const status of ["ACTIVE", "ON_TRACK", "AT_RISK", "OFF_TRACK"]) {
      mockFetch({
        "/api/growth-objectives/go-1/pacing": noPacing(),
        "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status } },
      });
      const { unmount } = render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
      await waitFor(() =>
        expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument(),
      );

      expect(screen.queryByTestId("action-analyze-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("action-activate-button")).not.toBeInTheDocument();
      expect(screen.getByTestId("action-check-progress-button")).toBeInTheDocument();
      unmount();
    }
  });

  it("shows no action buttons for a COMPLETED objective", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status: "COMPLETED" } },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("growth-objective-detail")).toBeInTheDocument());

    expect(screen.queryByTestId("action-analyze-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-activate-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("action-check-progress-button")).not.toBeInTheDocument();
  });

  it("a successful Analisa click refetches and updates the objective state", async () => {
    const analyzed = {
      ...BASE_OBJECTIVE,
      status: "PLANNED",
      forecast: { reverseFunnel: REVERSE_FUNNEL, feasibility: FEASIBILITY },
    };
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1/analyze": { method: "POST", body: analyzed },
      "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status: "DRAFT" } },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("action-analyze-button")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("action-analyze-button"));

    await waitFor(() =>
      expect(screen.getByTestId("objective-status-badge")).toHaveTextContent("Terencana"),
    );
    expect(screen.getByTestId("reverse-funnel-block")).toBeInTheDocument();
    // Status flipped to PLANNED — Analisa is no longer legal, Aktifkan now is.
    expect(screen.queryByTestId("action-analyze-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("action-activate-button")).toBeInTheDocument();
  });

  it("shows the real backend error message when an action fails (illegal transition)", async () => {
    mockFetch({
      "/api/growth-objectives/go-1/pacing": noPacing(),
      "/api/growth-objectives/go-1/analyze": {
        method: "POST",
        body: { error: { message: "Objective tidak bisa dianalisa dari status ini." } },
        status: 409,
      },
      "/api/growth-objectives/go-1": { body: { ...BASE_OBJECTIVE, status: "DRAFT" } },
    });
    render(<GrowthObjectiveDetailClient objectiveId="go-1" />);
    await waitFor(() => expect(screen.getByTestId("action-analyze-button")).toBeInTheDocument());

    await userEvent.click(screen.getByTestId("action-analyze-button"));

    await waitFor(() =>
      expect(screen.getByTestId("action-error")).toHaveTextContent(
        "Objective tidak bisa dianalisa dari status ini.",
      ),
    );
    // Status is untouched on failure — Analisa is still legal/shown.
    expect(screen.getByTestId("action-analyze-button")).toBeInTheDocument();
  });
});
